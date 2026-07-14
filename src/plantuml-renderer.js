import { renderToString } from "@plantuml/core";

export function renderPlantUml(source) {
  assertNoExternalIncludes(source);
  return new Promise((resolve, reject) => {
    renderToString(source.split("\n"), resolve, (message) => reject(new Error(String(message))));
  });
}

export function assertNoExternalIncludes(source) {
  if (/^\s*!(?:include|includeurl|include_once|include_many|import)\b/im.test(source)) {
    throw new Error("为避免读取外部资源，预览不支持 PlantUML 的 !include 或 !import 指令。 ");
  }
}

export function sanitizePlantUmlSvg(svg) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("PlantUML 返回了无效 SVG。 ");

  documentNode.querySelectorAll("script, iframe, object, embed, foreignObject").forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if (/^(?:href|xlink:href)$/i.test(attribute.name) && !attribute.value.startsWith("#")) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return documentNode.documentElement.outerHTML;
}
