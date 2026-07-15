import { validateSelection } from "./selection.js";
import { openPreviewWindow, renderInPageOverlay } from "./preview-request.js";

export const ACTION_MESSAGE_TYPES = new Set([
  "preview-active-selection",
  "preview-pasted-selection",
]);

export async function handleActionMessage(
  message,
  chromeApi,
  createId = () => crypto.randomUUID(),
) {
  if (!ACTION_MESSAGE_TYPES.has(message?.type)) return null;

  const [tab] = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
  if (!Number.isInteger(tab?.id)) {
    return { ok: false, reason: "tab", error: "没有找到可预览的当前页面。" };
  }

  let selection = "";
  let frameId = 0;
  if (message.type === "preview-active-selection") {
    const captured = await captureActiveSelection(tab, chromeApi);
    selection = captured.selection;
    frameId = captured.frameId;
  } else {
    selection = typeof message.selection === "string" ? message.selection : "";
  }

  const validation = validateSelection(selection);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "selection",
      error: validation.reason,
      selection,
    };
  }

  const result = await renderInPageOverlay(
    { frameId },
    tab,
    selection,
    chromeApi,
    validation.language,
  );
  if (result.ok) return result;

  if (result.reason === "render") {
    return { ...result, selection };
  }

  await openPreviewWindow(selection, chromeApi, createId);
  return { ok: true, mode: "window" };
}

export async function captureActiveSelection(tab, chromeApi) {
  if (!Number.isInteger(tab?.id) || !chromeApi.scripting?.executeScript) {
    return { selection: "", frameId: 0 };
  }

  try {
    const results = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => ({
        selection: globalThis.getSelection?.()?.toString() ?? "",
        focused: document.hasFocus(),
      }),
    });
    const candidates = results
      .map((entry) => ({
        selection: typeof entry?.result?.selection === "string" ? entry.result.selection : "",
        focused: entry?.result?.focused === true,
        frameId: Number.isInteger(entry?.frameId) ? entry.frameId : 0,
      }))
      .filter((entry) => entry.selection.trim())
      .sort((left, right) => Number(right.focused) - Number(left.focused)
        || right.selection.length - left.selection.length);
    return candidates[0] ?? { selection: "", frameId: 0 };
  } catch {
    return { selection: "", frameId: 0 };
  }
}
