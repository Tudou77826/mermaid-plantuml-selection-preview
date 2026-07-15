import { handleContextMenuClick, MENU_ID } from "./preview-request.js";
import { ACTION_MESSAGE_TYPES, handleActionMessage } from "./action-request.js";

const ENTRY_TTL_MS = 5 * 60 * 1000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "预览 Mermaid / PlantUML 图",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => handleContextMenuClick(info, tab, chrome));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!ACTION_MESSAGE_TYPES.has(message?.type)) return undefined;
  handleActionMessage(message, chrome).then(
    sendResponse,
    (error) => sendResponse({
      ok: false,
      reason: "unexpected",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return true;
});

chrome.runtime.onStartup.addListener(clearExpiredEntries);

async function clearExpiredEntries() {
  const entries = await chrome.storage.local.get(null);
  const now = Date.now();
  const expiredKeys = Object.entries(entries)
    .filter(([key, value]) => key.startsWith("preview:") && now - value.createdAt > ENTRY_TTL_MS)
    .map(([key]) => key);

  if (expiredKeys.length > 0) {
    await chrome.storage.local.remove(expiredKeys);
  }
}
