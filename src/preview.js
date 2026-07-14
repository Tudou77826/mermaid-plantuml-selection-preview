import mermaid from "mermaid";
import { validateSelection } from "./selection.js";
import { renderPlantUml, sanitizePlantUmlSvg } from "./plantuml-renderer.js";

const elements = {
  diagram: document.querySelector("#diagram"),
  viewport: document.querySelector("#diagram-viewport"),
  diagramMeta: document.querySelector("#diagram-meta"),
  source: document.querySelector("#source-code"),
  sourceMeta: document.querySelector("#source-meta"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  fitButton: document.querySelector("#fit-button"),
  copyButton: document.querySelector("#copy-button"),
  toast: document.querySelector("#toast"),
};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  suppressErrorRendering: true,
  maxTextSize: 100_000,
  themeVariables: {
    fontFamily: '"IBM Plex Sans", "Microsoft YaHei", sans-serif',
    primaryColor: "#e8f5ed",
    primaryTextColor: "#14251c",
    primaryBorderColor: "#277d50",
    lineColor: "#426153",
    secondaryColor: "#fff4c7",
    tertiaryColor: "#e8eef5",
    background: "#f7f7f2",
  },
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.close();
});
elements.fitButton.addEventListener("click", fitDiagram);
elements.copyButton.addEventListener("click", copySvg);

await renderSelection();

async function renderSelection() {
  try {
    const requestId = new URLSearchParams(location.search).get("id");
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      throw new Error("预览请求无效或已经过期，请回到文档页面重新框选。 ");
    }

    const storageKey = `preview:${requestId}`;
    const stored = await chrome.storage.local.get(storageKey);
    await chrome.storage.local.remove(storageKey);
    const result = validateSelection(stored[storageKey]?.selection);
    if (!result.ok) throw new Error(result.reason);

    elements.source.textContent = result.source;
    elements.sourceMeta.textContent = `${result.source.length.toLocaleString()} 字符`;

    if (result.language === "plantuml") {
      const svg = await renderPlantUml(result.source);
      elements.diagram.innerHTML = sanitizePlantUmlSvg(svg);
      elements.diagramMeta.textContent = "PlantUML 图表";
    } else {
      await mermaid.parse(result.source);
      const renderId = `mermaid-${requestId.replaceAll("-", "")}`;
      const { svg, bindFunctions } = await mermaid.render(renderId, result.source);
      elements.diagram.innerHTML = svg;
      bindFunctions?.(elements.diagram);
      elements.diagramMeta.textContent = detectDiagramType(result.source);
    }
    requestAnimationFrame(fitDiagram);
  } catch (error) {
    showError(error);
  }
}

function fitDiagram() {
  const svg = elements.diagram.querySelector("svg");
  if (!svg) return;
  svg.removeAttribute("height");
  svg.removeAttribute("width");
  svg.style.maxWidth = "100%";
  svg.style.maxHeight = "100%";
  svg.style.width = "100%";
  svg.style.height = "100%";
}

async function copySvg() {
  const svg = elements.diagram.querySelector("svg");
  if (!svg) return showToast("当前没有可复制的图表");
  try {
    await navigator.clipboard.writeText(svg.outerHTML);
    showToast("SVG 已复制");
  } catch {
    showToast("复制失败，请检查剪贴板权限");
  }
}

function showError(error) {
  elements.diagram.hidden = true;
  elements.errorPanel.hidden = false;
  elements.diagramMeta.textContent = "渲染失败";
  elements.errorMessage.textContent = cleanErrorMessage(error);
}

function cleanErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\n{3,}/g, "\n\n").trim();
}

function detectDiagramType(source) {
  const firstWord = source.trim().split(/[\s\n]+/, 1)[0]?.toLowerCase();
  const names = {
    graph: "流程图",
    flowchart: "流程图",
    sequencediagram: "时序图",
    classdiagram: "类图",
    statediagram: "状态图",
    erdiagram: "ER 图",
    gantt: "甘特图",
    pie: "饼图",
    mindmap: "思维导图",
    timeline: "时间线",
  };
  return names[firstWord] ?? "Mermaid 图表";
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("toast-visible"), 1800);
}
