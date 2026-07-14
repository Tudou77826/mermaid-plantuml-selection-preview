import { chromium } from "playwright-core";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const svg = await readFile(path.join(root, "assets", "icon.svg"), "utf8");
const output = path.join(root, "assets", "icons");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.screenshot({
      path: path.join(output, `icon-${size}.png`),
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Generated extension icons in ${output}`);
