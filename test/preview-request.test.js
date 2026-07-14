import test from "node:test";
import assert from "node:assert/strict";
import {
  captureDomSelection,
  handleContextMenuClick,
  MENU_ID,
  showInPageOverlay,
} from "../src/preview-request.js";

test("right-click handler stores selection and opens the preview popup", async () => {
  const writes = [];
  const windows = [];
  const chromeApi = {
    storage: { local: { set: async (value) => writes.push(value) } },
    windows: { create: async (value) => windows.push(value) },
    runtime: { getURL: (value) => `chrome-extension://test/${value}` },
    scripting: {
      executeScript: async () => [{ result: "flowchart TD\n  A --> B" }],
    },
  };
  const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const handled = await handleContextMenuClick(
    { menuItemId: MENU_ID, selectionText: "```mermaid\ngraph TD\nA-->B\n```" },
    { id: 42 },
    chromeApi,
    () => requestId,
  );

  assert.equal(handled, true);
  assert.equal(writes[0][`preview:${requestId}`].selection, "flowchart TD\n  A --> B");
  assert.deepEqual(windows[0], {
    url: `chrome-extension://test/preview.html?id=${requestId}`,
    type: "popup",
    width: 1120,
    height: 760,
    focused: true,
  });
});

test("right-click handler ignores unrelated menu items", async () => {
  const chromeApi = {
    storage: { local: { set: async () => assert.fail("must not store") } },
    windows: { create: async () => assert.fail("must not open") },
    runtime: { getURL: () => "" },
  };
  assert.equal(await handleContextMenuClick({ menuItemId: "other" }, { id: 42 }, chromeApi), false);
});

test("DOM selection preserves newlines collapsed by contextMenus", async () => {
  const chromeApi = {
    scripting: {
      executeScript: async ({ target }) => {
        assert.deepEqual(target, { tabId: 7, frameIds: [3] });
        return [{ result: "flowchart LR\n  A --> B\n  B --> C" }];
      },
    },
  };
  const result = await captureDomSelection(
    { frameId: 3, selectionText: "flowchart LR A --> B B --> C" },
    { id: 7 },
    chromeApi,
  );
  assert.equal(result, "flowchart LR\n  A --> B\n  B --> C");
});

test("selection capture falls back when page injection is unavailable", async () => {
  const chromeApi = {
    scripting: { executeScript: async () => { throw new Error("restricted page"); } },
  };
  assert.equal(
    await captureDomSelection({ selectionText: "graph TD\nA-->B" }, { id: 8 }, chromeApi),
    "graph TD\nA-->B",
  );
});

test("page overlay injection targets the selected frame and sends exact source", async () => {
  const injections = [];
  const messages = [];
  const chromeApi = {
    scripting: {
      executeScript: async (request) => {
        injections.push(request);
        return [{ result: false }];
      },
    },
    tabs: {
      sendMessage: async (...args) => {
        messages.push(args);
        return { ok: true };
      },
    },
  };

  const shown = await showInPageOverlay(
    { frameId: 5 },
    { id: 77 },
    "sequenceDiagram\nA->>B: hello",
    chromeApi,
  );

  assert.equal(shown, true);
  assert.equal(injections.length, 2);
  assert.deepEqual(injections[1], { target: { tabId: 77, frameIds: [5] }, files: ["overlay.js"] });
  assert.deepEqual(messages, [[
    77,
    { type: "show-mermaid-selection-overlay", selection: "sequenceDiagram\nA->>B: hello" },
    { frameId: 5 },
  ]]);
});

test("PlantUML overlay loads the local TeaVM renderer", async () => {
  const injections = [];
  const messages = [];
  const chromeApi = {
    scripting: {
      executeScript: async (request) => {
        injections.push(request);
        return [{ result: false }];
      },
    },
    tabs: {
      sendMessage: async (...args) => {
        messages.push(args);
        return { ok: true };
      },
    },
  };
  const source = "@startuml\nAlice -> Bob: Hello\n@enduml";
  assert.equal(await showInPageOverlay({}, { id: 91 }, source, chromeApi), true);
  assert.deepEqual(injections[1].files, ["viz-global.js", "overlay.js", "plantuml-overlay.js"]);
  assert.equal(messages[0][1].type, "show-plantuml-selection-overlay");
});

test("cached page renderer is reused without injecting the bundle again", async () => {
  const injections = [];
  const chromeApi = {
    scripting: {
      executeScript: async (request) => {
        injections.push(request);
        return [{ result: true }];
      },
    },
    tabs: { sendMessage: async () => ({ ok: true }) },
  };
  assert.equal(await showInPageOverlay({}, { id: 12 }, "graph TD\nA-->B", chromeApi), true);
  assert.equal(injections.length, 1);
  assert.equal(typeof injections[0].func, "function");
});
