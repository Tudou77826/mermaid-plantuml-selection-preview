import { chromium } from "playwright-core";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const extensionPath = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(extensionPath, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions.sort(), ["activeTab", "contextMenus", "scripting", "storage"]);

const profilePath = await mkdtemp(path.join(os.tmpdir(), "mermaid-preview-e2e-"));
let context;

try {
  context = await chromium.launchPersistentContext(profilePath, {
    // Extension side-loading remains supported in Playwright's Chromium build.
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--window-position=-2000,-2000",
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  assert.match(extensionId, /^[a-p]{32}$/);

  const overlayPage = await context.newPage();
  await overlayPage.goto(`chrome-extension://${extensionId}/overlay-host.html`);
  const overlayResponse = await worker.evaluate(
    async (selection) => chrome.runtime.sendMessage({
      type: "show-mermaid-selection-overlay",
      selection,
    }),
    "sequenceDiagram\n  actor U as 用户\n  participant A as 应用\n  U->>A: 打开预览\n  A-->>U: 返回图表",
  );
  assert.deepEqual(overlayResponse, { ok: true });
  const renderedOverlaySvg = overlayPage.locator("#mermaid-selection-overlay .diagram > svg");
  await renderedOverlaySvg.waitFor({ state: "visible" });
  assert.equal(await overlayPage.locator("#mermaid-selection-overlay").count(), 1);
  await overlayPage.waitForFunction(() => {
    const host = document.querySelector("#mermaid-selection-overlay");
    return host?.shadowRoot?.querySelector(".scale-button")?.textContent !== "100%";
  });
  const svgBox = await renderedOverlaySvg.boundingBox();
  assert.ok(svgBox.width >= 360, `fitted diagram should be comfortably sized, got ${svgBox.width}px`);
  const overlayArtifactDir = path.join(root, ".artifacts");
  await mkdir(overlayArtifactDir, { recursive: true });
  await overlayPage.screenshot({ path: path.join(overlayArtifactDir, "overlay-e2e.png") });
  const scaleControl = overlayPage.getByRole("button", { name: "恢复百分之百大小" });
  const scaleBeforeZoom = await scaleControl.textContent();
  const zoomIn = overlayPage.getByRole("button", { name: "放大" });
  assert.equal(await zoomIn.count(), 1);
  await zoomIn.click();
  assert.notEqual(await scaleControl.textContent(), scaleBeforeZoom);
  await overlayPage.keyboard.press("Escape");
  await overlayPage.locator("#mermaid-selection-overlay").waitFor({ state: "detached" });

  const plantUmlResponse = await worker.evaluate(
    async (selection) => chrome.runtime.sendMessage({
      type: "show-plantuml-selection-overlay",
      selection,
    }),
    "```plantuml\n@startuml\nleft to right direction\npackage 订单域 {\n  class Order {\n    +confirm()\n    +cancel()\n  }\n  class OrderLine\n  interface OrderRepository\n  class OrderService\n  Order \"1\" *-- \"1..*\" OrderLine\n  OrderService --> OrderRepository\n  OrderRepository ..> Order\n}\n@enduml\n```",
  );
  assert.deepEqual(plantUmlResponse, { ok: true });
  const plantUmlSvg = overlayPage.locator("#mermaid-selection-overlay .diagram > svg");
  await plantUmlSvg.waitFor({ state: "visible", timeout: 30_000 });
  assert.match(await plantUmlSvg.textContent(), /OrderService/);
  await overlayPage.waitForTimeout(250);
  await overlayPage.screenshot({ path: path.join(overlayArtifactDir, "plantuml-overlay-e2e.png") });
  await overlayPage.keyboard.press("Escape");
  await overlayPage.locator("#mermaid-selection-overlay").waitFor({ state: "detached" });
  await overlayPage.close();

  await verifyPreview({
    requestId: "11111111-1111-4111-8111-111111111111",
    selection: "```mermaid\nflowchart LR\n  A[文档] --> B[预览]\n```",
    expectedSource: "flowchart LR\n  A[文档] --> B[预览]",
    expectedMeta: "流程图",
  });

  await verifyPreview({
    requestId: "22222222-2222-4222-8222-222222222222",
    selection: "sequenceDiagram\n  Alice->>Bob: 本地渲染",
    expectedSource: "sequenceDiagram\n  Alice->>Bob: 本地渲染",
    expectedMeta: "时序图",
  });

  const testDocument = await readFile(path.join(root, "mermaid-complex-test.md"), "utf8");
  const complexBlocks = [...testDocument.matchAll(/```mermaid\s*\n([\s\S]*?)\n```/g)].map((match) => match[1]);
  assert.equal(complexBlocks.length, 8, "complex test document should contain eight Mermaid diagrams");
  for (const [index, source] of complexBlocks.entries()) {
    const suffix = String(index + 10).padStart(12, "0");
    await verifyPreview({
      requestId: `44444444-4444-4444-8444-${suffix}`,
      selection: source,
      expectedSource: source,
      expectedMeta: null,
    });
  }

  const invalidId = "33333333-3333-4333-8333-333333333333";
  await storeSelection(invalidId, "this is not valid mermaid ???");
  const invalidPage = await context.newPage();
  await invalidPage.goto(`chrome-extension://${extensionId}/preview.html?id=${invalidId}`);
  await invalidPage.locator("#error-panel").waitFor({ state: "visible" });
  assert.equal(await invalidPage.locator("#diagram-meta").textContent(), "渲染失败");
  await invalidPage.close();

  console.log("E2E passed: Mermaid and PlantUML rendering, interactive sizing, fenced/raw source, and errors.");

  async function verifyPreview({ requestId, selection, expectedSource, expectedMeta }) {
    await storeSelection(requestId, selection);
    const page = await context.newPage();
    const externalRequests = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) externalRequests.push(request.url());
    });
    await page.goto(`chrome-extension://${extensionId}/preview.html?id=${requestId}`);
    await page.locator("#diagram svg, #error-panel:not([hidden])").waitFor({ state: "visible" });
    if (await page.locator("#error-panel").isVisible()) {
      const message = await page.locator("#error-message").textContent();
      throw new Error(`Mermaid render failed for ${requestId}: ${message}`);
    }
    assert.equal(await page.locator("#source-code").textContent(), expectedSource);
    if (expectedMeta) assert.equal(await page.locator("#diagram-meta").textContent(), expectedMeta);
    assert.equal(await page.locator("#error-panel").isVisible(), false);
    assert.deepEqual(externalRequests, []);
    const stored = await worker.evaluate(async (key) => chrome.storage.local.get(key), `preview:${requestId}`);
    assert.deepEqual(stored, {});
    if (requestId.startsWith("1111")) {
      const artifactDir = path.join(root, ".artifacts");
      await mkdir(artifactDir, { recursive: true });
      await page.screenshot({ path: path.join(artifactDir, "preview-e2e.png"), fullPage: true });
    }
    await page.close();
  }

  async function storeSelection(requestId, selection) {
    await worker.evaluate(
      async ({ key, value }) => chrome.storage.local.set({ [key]: value }),
      {
        key: `preview:${requestId}`,
        value: { selection, createdAt: Date.now() },
      },
    );
  }
} finally {
  await context?.close();
  await rm(profilePath, { recursive: true, force: true });
}
