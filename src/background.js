import { handleContextMenuClick, MENU_ID } from "./preview-request.js";

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
