import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const src = path.join(webRoot, "..", "core-js");
const dest = path.join(webRoot, "public", "core-js");

if (!fs.existsSync(src)) {
  console.error("Source not found:", src);
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  if (!name.endsWith(".js")) continue;
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log("Synced core-js ->", dest);
