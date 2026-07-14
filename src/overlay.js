import mermaid from "mermaid";
import { validateSelection } from "./selection.js";

const INSTALL_KEY = "__mermaidSelectionOverlayInstalled";
const HOST_ID = "mermaid-selection-overlay";

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    suppressErrorRendering: true,
    maxTextSize: 100_000,
    themeVariables: {
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      primaryColor: "#e8f5ed",
      primaryTextColor: "#14251c",
      primaryBorderColor: "#277d50",
      lineColor: "#426153",
      secondaryColor: "#fff4c7",
      tertiaryColor: "#e8eef5",
      background: "#fffefa",
    },
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "show-mermaid-selection-overlay") return undefined;

    renderOverlay(message.selection).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return true;
  });
}

async function renderOverlay(selection) {
  const result = validateSelection(selection);
  if (!result.ok) throw new Error(result.reason);
  if (result.language !== "mermaid") throw new Error("选区不是 Mermaid 图表。 ");

  await mermaid.parse(result.source);
  const renderId = `mermaid-overlay-${crypto.randomUUID().replaceAll("-", "")}`;
  const { svg, bindFunctions } = await mermaid.render(renderId, result.source);
  showSvgOverlay(svg, bindFunctions);
}

function showSvgOverlay(svg, bindFunctions) {
  const existingHost = document.getElementById(HOST_ID);
  existingHost?.__mermaidOverlayCleanup?.();
  existingHost?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        overflow: hidden;
        padding: clamp(20px, 4vw, 64px);
        background: rgba(16, 27, 20, .10);
        animation: mermaid-overlay-fade 160ms ease-out;
      }
      .viewer {
        position: relative;
        width: min(1200px, 86vw);
        height: min(780px, 78vh);
        overflow: hidden;
        background: #fcfdfa;
        border: 1px solid rgba(45, 69, 55, .18);
        border-radius: 18px;
        box-shadow: 0 24px 80px rgba(17, 29, 21, .24), 0 4px 16px rgba(17, 29, 21, .12);
        animation: mermaid-viewer-in 190ms cubic-bezier(.2, .75, .25, 1);
      }
      .viewport {
        position: absolute;
        inset: 0;
        overflow: hidden;
        outline: none;
        cursor: grab;
        touch-action: none;
        background-image:
          linear-gradient(rgba(31, 72, 48, .028) 1px, transparent 1px),
          linear-gradient(90deg, rgba(31, 72, 48, .028) 1px, transparent 1px);
        background-size: 28px 28px;
      }
      .viewport.dragging { cursor: grabbing; }
      .viewport:focus-visible { box-shadow: inset 0 0 0 2px rgba(39, 125, 80, .28); }
      .scene {
        position: absolute;
        left: 0;
        top: 0;
        transform-origin: 0 0;
        will-change: transform;
      }
      .diagram {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        padding: 32px;
        background: transparent;
      }
      .diagram svg {
        display: block;
        max-width: none;
        max-height: none;
      }
      .toolbar {
        position: absolute;
        left: 50%;
        bottom: max(22px, env(safe-area-inset-bottom));
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px;
        color: #26372d;
        background: rgba(255, 255, 253, .92);
        border: 1px solid rgba(45, 69, 55, .16);
        border-radius: 15px;
        box-shadow: 0 9px 28px rgba(17, 29, 21, .16);
        backdrop-filter: blur(16px);
        transform: translateX(-50%);
        opacity: .82;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .toolbar:hover, .toolbar:focus-within {
        opacity: 1;
        transform: translateX(-50%) translateY(-2px);
      }
      .tool-button {
        all: unset;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        color: inherit;
        cursor: pointer;
        transition: color 160ms ease, background 160ms ease;
      }
      .tool-button:hover { color: #196b43; background: rgba(31, 116, 73, .09); }
      .tool-button:focus-visible { outline: 2px solid #277d50; outline-offset: -2px; }
      .tool-button svg { width: 20px; height: 20px; stroke: currentColor; }
      .scale-button {
        width: 66px;
        color: #196b43;
        font: 650 12px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
        letter-spacing: -.02em;
      }
      .divider { width: 1px; height: 24px; margin: 0 2px; background: rgba(45, 69, 55, .16); }
      @keyframes mermaid-overlay-fade {
        from { opacity: 0; }
      }
      @keyframes mermaid-viewer-in {
        from { opacity: 0; transform: translateY(8px) scale(.99); }
      }
      @media (prefers-reduced-motion: reduce) {
        .backdrop, .viewer { animation: none; }
        .toolbar, .tool-button { transition: none; }
      }
      @media (max-width: 520px) {
        .backdrop { padding: 8px; }
        .viewer {
          width: calc(100vw - 16px);
          height: calc(100vh - 24px);
          border-radius: 14px;
        }
        .toolbar { bottom: max(12px, env(safe-area-inset-bottom)); }
        .tool-button { width: 44px; height: 44px; }
        .scale-button { width: 58px; }
        .diagram { padding: 22px; border-radius: 9px; }
      }
    </style>
    <div class="backdrop" role="dialog" aria-modal="true" aria-label="Mermaid 图表预览">
      <div class="viewer">
        <div class="viewport" tabindex="0" aria-label="可缩放和拖动的 Mermaid 图表">
          <div class="scene"><div class="diagram"></div></div>
        </div>
        <div class="toolbar" role="toolbar" aria-label="图表视图控制">
          <button class="tool-button" data-action="zoom-out" type="button" aria-label="缩小" title="缩小">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14"/></svg>
          </button>
          <button class="tool-button scale-button" data-action="actual" type="button" aria-label="恢复百分之百大小" title="恢复 100%">100%</button>
          <button class="tool-button" data-action="zoom-in" type="button" aria-label="放大" title="放大">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="tool-button" data-action="fit" type="button" aria-label="适应窗口" title="适应窗口（双击图表）">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg>
          </button>
          <span class="divider" aria-hidden="true"></span>
          <button class="tool-button" data-action="close" type="button" aria-label="关闭" title="关闭（Esc）">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  const backdrop = shadow.querySelector(".backdrop");
  const viewport = shadow.querySelector(".viewport");
  const scene = shadow.querySelector(".scene");
  const diagram = shadow.querySelector(".diagram");
  const scaleButton = shadow.querySelector(".scale-button");
  diagram.innerHTML = svg;
  bindFunctions?.(diagram);

  const svgElement = diagram.querySelector("svg");
  const viewBox = svgElement.viewBox?.baseVal;
  const graphWidth = Math.max(1, viewBox?.width || parseFloat(svgElement.getAttribute("width")) || 800);
  const graphHeight = Math.max(1, viewBox?.height || parseFloat(svgElement.getAttribute("height")) || 600);
  const sceneWidth = graphWidth + 64;
  const sceneHeight = graphHeight + 64;
  svgElement.setAttribute("width", String(graphWidth));
  svgElement.setAttribute("height", String(graphHeight));
  svgElement.style.width = `${graphWidth}px`;
  svgElement.style.height = `${graphHeight}px`;
  scene.style.width = `${sceneWidth}px`;
  scene.style.height = `${sceneHeight}px`;

  let scale = 1;
  let x = 0;
  let y = 0;
  let fitScale = 1;
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const previousActiveElement = document.activeElement;
  let closed = false;

  const paint = () => {
    scene.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    scaleButton.textContent = `${Math.round(scale * 100)}%`;
  };
  const centerAt = (nextScale) => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    scale = nextScale;
    x = (width - sceneWidth * scale) / 2;
    y = (height - sceneHeight * scale) / 2;
    paint();
  };
  const fit = () => {
    const horizontalMargin = Math.min(160, Math.max(56, viewport.clientWidth * .1));
    const verticalMargin = Math.min(180, Math.max(112, viewport.clientHeight * .16));
    fitScale = Math.min(
      (viewport.clientWidth - horizontalMargin) / sceneWidth,
      (viewport.clientHeight - verticalMargin) / sceneHeight,
    );
    fitScale = Math.max(.06, Math.min(2.5, fitScale));
    centerAt(fitScale);
  };
  const zoomAt = (nextScale, clientX = viewport.clientWidth / 2, clientY = viewport.clientHeight / 2) => {
    const minimum = Math.max(.04, fitScale * .2);
    const maximum = Math.max(6, fitScale * 4);
    nextScale = Math.max(minimum, Math.min(maximum, nextScale));
    const worldX = (clientX - x) / scale;
    const worldY = (clientY - y) / scale;
    x = clientX - worldX * nextScale;
    y = clientY - worldY * nextScale;
    scale = nextScale;
    paint();
  };

  const close = () => {
    if (closed) return;
    closed = true;
    host.__mermaidOverlayCleanup?.();
    host.remove();
    previousActiveElement?.focus?.({ preventScroll: true });
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAt(scale * 1.2);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomAt(scale / 1.2);
    } else if (event.key === "0") {
      event.preventDefault();
      fit();
    } else if (event.key === "1") {
      event.preventDefault();
      centerAt(1);
    }
  };
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * .0015);
    zoomAt(scale * factor, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    x += event.clientX - lastPointerX;
    y += event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    paint();
  });
  const stopDragging = (event) => {
    dragging = false;
    viewport.classList.remove("dragging");
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);
  viewport.addEventListener("dblclick", fit);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  shadow.querySelector('[data-action="zoom-out"]').addEventListener("click", () => zoomAt(scale / 1.2));
  shadow.querySelector('[data-action="actual"]').addEventListener("click", () => centerAt(1));
  shadow.querySelector('[data-action="zoom-in"]').addEventListener("click", () => zoomAt(scale * 1.2));
  shadow.querySelector('[data-action="fit"]').addEventListener("click", fit);
  shadow.querySelector('[data-action="close"]').addEventListener("click", close);

  const resizeObserver = new ResizeObserver(() => {
    if (host.isConnected) fit();
  });
  host.__mermaidOverlayCleanup = () => {
    document.removeEventListener("keydown", onKeydown, true);
    resizeObserver.disconnect();
  };
  document.addEventListener("keydown", onKeydown, true);
  document.documentElement.append(host);
  resizeObserver.observe(viewport);
  requestAnimationFrame(() => {
    fit();
    viewport.focus({ preventScroll: true });
  });
}

globalThis.__showDiagramSvgOverlay = showSvgOverlay;
