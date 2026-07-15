import { detectDiagramLanguage } from "./selection.js";

export const MENU_ID = "preview-selected-mermaid";

export async function handleContextMenuClick(
  info,
  tab,
  chromeApi,
  createId = () => crypto.randomUUID(),
) {
  if (info.menuItemId !== MENU_ID) {
    return false;
  }

  const selection = await captureDomSelection(info, tab, chromeApi);
  const language = detectDiagramLanguage(selection);
  const displayedInPage = await renderInPageOverlay(info, tab, selection, chromeApi, language);
  if (displayedInPage.ok) {
    return true;
  }

  await openPreviewWindow(selection, chromeApi, createId);
  return true;
}

export async function openPreviewWindow(
  selection,
  chromeApi,
  createId = () => crypto.randomUUID(),
) {
  const requestId = createId();
  // Restricted pages (for example chrome:// pages) cannot accept injected
  // scripts. Keep the original extension window as a functional fallback.
  const storageKey = `preview:${requestId}`;
  // storage.local is used instead of storage.session because some Chrome
  // versions can expose a newly-created extension popup before the session
  // write becomes visible to that document. The entry is consumed and
  // deleted immediately by preview.js.
  await chromeApi.storage.local.set({
    [storageKey]: {
      selection,
      createdAt: Date.now(),
    },
  });

  await chromeApi.windows.create({
    url: chromeApi.runtime.getURL(`preview.html?id=${encodeURIComponent(requestId)}`),
    type: "popup",
    width: 1120,
    height: 760,
    focused: true,
  });
  return true;
}

export async function renderInPageOverlay(
  info,
  tab,
  selection,
  chromeApi,
  language = detectDiagramLanguage(selection),
) {
  if (
    !Number.isInteger(tab?.id) ||
    !chromeApi.scripting?.executeScript ||
    !chromeApi.tabs?.sendMessage
  ) {
    return { ok: false, reason: "injection", error: "当前页面不允许显示页内预览。" };
  }

  const target = { tabId: tab.id };
  const frameId = Number.isInteger(info.frameId) ? info.frameId : 0;
  target.frameIds = [frameId];

  try {
    const rendererKey = language === "plantuml"
      ? "__plantUmlSelectionOverlayInstalled"
      : "__mermaidSelectionOverlayInstalled";
    const [status] = await chromeApi.scripting.executeScript({
      target,
      func: (key) => Boolean(globalThis[key]),
      args: [rendererKey],
    });
    const files = language === "plantuml"
      ? ["viz-global.js", "overlay.js", "plantuml-overlay.js"]
      : ["overlay.js"];
    if (!status?.result) await chromeApi.scripting.executeScript({ target, files });
    const response = await chromeApi.tabs.sendMessage(
      tab.id,
      { type: `show-${language}-selection-overlay`, selection },
      { frameId },
    );
    if (response?.ok === true) return { ok: true, mode: "overlay" };
    return {
      ok: false,
      reason: "render",
      error: response?.error || "图表源码暂时无法渲染。",
    };
  } catch (error) {
    return {
      ok: false,
      reason: "injection",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function showInPageOverlay(info, tab, selection, chromeApi, language) {
  return (await renderInPageOverlay(info, tab, selection, chromeApi, language)).ok;
}

/**
 * contextMenus.onClicked may collapse line breaks in text selected from a
 * rendered <pre>/<code> block. Reading Selection from the active frame keeps
 * the exact line structure Mermaid requires.
 */
export async function captureDomSelection(info, tab, chromeApi) {
  if (Number.isInteger(tab?.id) && chromeApi.scripting?.executeScript) {
    try {
      const target = { tabId: tab.id };
      if (Number.isInteger(info.frameId)) target.frameIds = [info.frameId];
      const results = await chromeApi.scripting.executeScript({
        target,
        func: () => globalThis.getSelection?.()?.toString() ?? "",
      });
      const domSelection = results?.[0]?.result;
      if (typeof domSelection === "string" && domSelection.trim()) {
        return domSelection;
      }
    } catch {
      // Restricted pages do not allow injection. The context-menu value is
      // still useful as a fallback for plain-text selections.
    }
  }
  return info.selectionText ?? "";
}
