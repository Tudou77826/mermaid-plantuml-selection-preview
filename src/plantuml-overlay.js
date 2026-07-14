import { validateSelection } from "./selection.js";
import { renderPlantUml, sanitizePlantUmlSvg } from "./plantuml-renderer.js";

const INSTALL_KEY = "__plantUmlSelectionOverlayInstalled";

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "show-plantuml-selection-overlay") return undefined;

    renderPlantUmlOverlay(message.selection).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return true;
  });
}

async function renderPlantUmlOverlay(selection) {
  const result = validateSelection(selection);
  if (!result.ok) throw new Error(result.reason);
  if (result.language !== "plantuml") throw new Error("选区不是 PlantUML 图表。 ");
  const svg = await renderPlantUml(result.source);
  globalThis.__showDiagramSvgOverlay(sanitizePlantUmlSvg(svg));
}
