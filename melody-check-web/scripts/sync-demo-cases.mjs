import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const src = path.join(webRoot, "..", "demo-cases");
const dest = path.join(webRoot, "public", "demo-cases");

if (!fs.existsSync(src)) {
  console.error("Source not found:", src);
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  const from = path.join(src, name);
  if (fs.statSync(from).isFile()) {
    fs.copyFileSync(from, path.join(dest, name));
  }
}
console.log("Synced demo-cases ->", dest);
