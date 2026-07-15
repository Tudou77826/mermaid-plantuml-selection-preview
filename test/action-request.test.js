import test from "node:test";
import assert from "node:assert/strict";
import { captureActiveSelection, handleActionMessage } from "../src/action-request.js";

test("action selection capture prefers the focused frame", async () => {
  const chromeApi = {
    scripting: {
      executeScript: async (request) => {
        assert.deepEqual(request.target, { tabId: 9, allFrames: true });
        return [
          { frameId: 0, result: { selection: "flowchart LR\nA-->B", focused: false } },
          { frameId: 7, result: { selection: "sequenceDiagram\nA->>B: hello", focused: true } },
        ];
      },
    },
  };

  assert.deepEqual(await captureActiveSelection({ id: 9 }, chromeApi), {
    selection: "sequenceDiagram\nA->>B: hello",
    focused: true,
    frameId: 7,
  });
});

test("action reports an empty selection without requesting broad permissions", async () => {
  const chromeApi = {
    tabs: { query: async () => [{ id: 3 }] },
    scripting: { executeScript: async () => [{ frameId: 0, result: { selection: "", focused: true } }] },
  };
  const result = await handleActionMessage({ type: "preview-active-selection" }, chromeApi);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "selection");
  assert.match(result.error, /没有读取到/);
});

test("pasted source renders in the active page overlay", async () => {
  const messages = [];
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 14 }],
      sendMessage: async (...args) => {
        messages.push(args);
        return { ok: true };
      },
    },
    scripting: { executeScript: async () => [{ result: true }] },
  };
  const result = await handleActionMessage({
    type: "preview-pasted-selection",
    selection: "flowchart LR\nA-->B",
  }, chromeApi);
  assert.deepEqual(result, { ok: true, mode: "overlay" });
  assert.equal(messages[0][0], 14);
  assert.equal(messages[0][2].frameId, 0);
});

test("render errors return the source to the compact editor", async () => {
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 15 }],
      sendMessage: async () => ({ ok: false, error: "Parse error on line 2" }),
    },
    scripting: { executeScript: async () => [{ result: true }] },
  };
  const selection = "flowchart LR\nA -->";
  const result = await handleActionMessage({
    type: "preview-pasted-selection",
    selection,
  }, chromeApi);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "render");
  assert.equal(result.selection, selection);
});

test("restricted pages fall back to the existing standalone renderer", async () => {
  const writes = [];
  const windows = [];
  const chromeApi = {
    tabs: { query: async () => [{ id: 16 }] },
    scripting: { executeScript: async () => { throw new Error("restricted"); } },
    storage: { local: { set: async (value) => writes.push(value) } },
    windows: { create: async (value) => windows.push(value) },
    runtime: { getURL: (value) => `chrome-extension://test/${value}` },
  };
  const result = await handleActionMessage({
    type: "preview-pasted-selection",
    selection: "@startuml\nA->B\n@enduml",
  }, chromeApi, () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.deepEqual(result, { ok: true, mode: "window" });
  assert.equal(writes.length, 1);
  assert.equal(windows[0].width, 1120);
});
