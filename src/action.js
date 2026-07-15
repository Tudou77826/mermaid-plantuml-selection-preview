const scanning = document.querySelector("#scanning");
const form = document.querySelector("#manual-form");
const source = document.querySelector("#source");
const status = document.querySelector("#status");
const renderButton = document.querySelector("#render-button");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  renderManualSource();
});

source.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});

start();

async function start() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "preview-active-selection" });
    if (result?.ok) {
      window.close();
      return;
    }
    showManualInput(result);
  } catch {
    showManualInput({ error: "未能读取当前页面，请直接粘贴图表源码。" });
  }
}

function showManualInput(result = {}) {
  scanning.hidden = true;
  form.hidden = false;
  source.value = typeof result.selection === "string" ? result.selection : "";
  setStatus(
    result.reason === "render"
      ? cleanRenderError(result.error)
      : "未读取到可预览的选区，请粘贴源码后按 Ctrl+Enter。",
    result.reason === "render",
  );
  source.focus();
  if (source.value) source.select();
}

async function renderManualSource() {
  const selection = source.value.trim();
  if (!selection) {
    setStatus("请先粘贴 Mermaid 或 PlantUML 源码。", true);
    source.focus();
    return;
  }

  renderButton.disabled = true;
  setStatus("正在本地渲染…");
  try {
    const result = await chrome.runtime.sendMessage({
      type: "preview-pasted-selection",
      selection,
    });
    if (result?.ok) {
      window.close();
      return;
    }
    setStatus(cleanRenderError(result?.error), true);
  } catch {
    setStatus("预览暂时失败，请重试。", true);
  } finally {
    renderButton.disabled = false;
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function cleanRenderError(message) {
  const text = typeof message === "string" ? message.trim() : "图表源码暂时无法渲染。";
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? text;
  return firstLine.length > 150 ? `${firstLine.slice(0, 147)}…` : firstLine;
}
