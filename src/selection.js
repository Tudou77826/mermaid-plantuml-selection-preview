const DIAGRAM_OPENING_FENCE = /^(?:\uFEFF)?[ \t]*(?<fence>`{3,}|~{3,})[ \t]*(?<language>mermaid|plantuml|puml|uml)(?:[ \t]+[^\r\n]*)?[ \t]*(?:\r?\n|$)/i;

/**
 * Converts a browser selection into Mermaid source.
 * The selection may be raw Mermaid text or a Markdown fenced code block.
 */
export function normalizeMermaidSelection(selection) {
  return parseDiagramSelection(selection).source;
}

export function parseDiagramSelection(selection) {
  if (typeof selection !== "string") {
    return { source: "", language: "mermaid" };
  }

  let source = selection.replace(/\r\n?/g, "\n").trim();
  const opening = source.match(DIAGRAM_OPENING_FENCE);
  let language = normalizeLanguage(opening?.groups?.language);

  if (opening?.groups?.fence) {
    source = source.slice(opening[0].length);
    const fenceCharacter = opening.groups.fence[0];
    const minimumLength = opening.groups.fence.length;
    const closingFence = new RegExp(
      `(?:^|\\n)[ \\t]*${escapeRegExp(fenceCharacter)}{${minimumLength},}[ \\t]*$`,
    );
    source = source.replace(closingFence, "");
  }

  source = source.trim();
  if (!opening) language = /^@start\w*/i.test(source) ? "plantuml" : "mermaid";
  if (language === "plantuml" && source && !/^@start\w*/i.test(source)) {
    source = `@startuml\n${source}\n@enduml`;
  }
  return { source, language };
}

export function detectDiagramLanguage(selection) {
  return parseDiagramSelection(selection).language;
}

export function validateSelection(selection, maxLength = 100_000) {
  const { source, language } = parseDiagramSelection(selection);

  if (!source) {
    return { ok: false, reason: "没有读取到图表源码，请重新框选后再试。" };
  }

  if (source.length > maxLength) {
    return {
      ok: false,
      reason: `选区过大（${source.length.toLocaleString()} 字符），最多支持 ${maxLength.toLocaleString()} 字符。`,
    };
  }

  return { ok: true, source, language };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLanguage(language) {
  return /^(?:plantuml|puml|uml)$/i.test(language ?? "") ? "plantuml" : "mermaid";
}
