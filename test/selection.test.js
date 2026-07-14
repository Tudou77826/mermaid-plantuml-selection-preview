import test from "node:test";
import assert from "node:assert/strict";
import {
  detectDiagramLanguage,
  normalizeMermaidSelection,
  parseDiagramSelection,
  validateSelection,
} from "../src/selection.js";

test("keeps raw Mermaid source unchanged", () => {
  const input = "flowchart TD\n  A[开始] --> B[结束]";
  assert.equal(normalizeMermaidSelection(input), input);
});

test("removes a complete mermaid backtick fence", () => {
  const input = "```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```";
  assert.equal(normalizeMermaidSelection(input), "sequenceDiagram\n  Alice->>Bob: Hello");
});

test("removes opening mermaid fence when closing fence was not selected", () => {
  const input = "``` mermaid\ngraph LR\n  A --> B";
  assert.equal(normalizeMermaidSelection(input), "graph LR\n  A --> B");
});

test("supports tilde fences and CRLF", () => {
  const input = "~~~~MERMAID\r\npie title Pets\r\n  \"Dogs\" : 4\r\n~~~~";
  assert.equal(normalizeMermaidSelection(input), 'pie title Pets\n  "Dogs" : 4');
});

test("does not strip a non-mermaid Markdown fence", () => {
  const input = "```text\ngraph TD\nA --> B\n```";
  assert.equal(normalizeMermaidSelection(input), input);
});

test("rejects empty and oversized selections", () => {
  assert.deepEqual(validateSelection("  "), {
    ok: false,
    reason: "没有读取到图表源码，请重新框选后再试。",
  });
  assert.equal(validateSelection("graph TD\nA-->B", 4).ok, false);
});

test("returns normalized source on success", () => {
  assert.deepEqual(validateSelection("```mermaid\ngraph TD\nA-->B\n```"), {
    ok: true,
    source: "graph TD\nA-->B",
    language: "mermaid",
  });
});

test("recognizes complete PlantUML source", () => {
  const source = "@startuml\nAlice -> Bob: Hello\n@enduml";
  assert.equal(detectDiagramLanguage(source), "plantuml");
  assert.deepEqual(parseDiagramSelection(source), { source, language: "plantuml" });
});

test("strips PlantUML fences and adds missing document markers", () => {
  assert.deepEqual(parseDiagramSelection("```puml\nAlice -> Bob: Hello\n```"), {
    source: "@startuml\nAlice -> Bob: Hello\n@enduml",
    language: "plantuml",
  });
});
