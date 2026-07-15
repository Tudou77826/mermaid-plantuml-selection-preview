import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("manifest is valid MV3 and requests only the intended permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.7.0");
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.equal("host_permissions" in manifest, false);
  assert.equal("content_scripts" in manifest, false);
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.equal(manifest.action.default_popup, "action.html");
  assert.equal(manifest.commands._execute_action.suggested_key.default, "Ctrl+Shift+M");
});
