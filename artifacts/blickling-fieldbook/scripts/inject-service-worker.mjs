import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDirectory = path.resolve(import.meta.dirname, "../dist/public");
const workerPath = path.join(publicDirectory, "service-worker.js");

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

const assets = (await listFiles(publicDirectory))
  .filter((file) => file.startsWith("assets/"))
  .sort()
  .map((file) => `/${file}`);

if (assets.length === 0) throw new Error("No production assets were found for offline caching");

const buildId = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
const source = await readFile(workerPath, "utf8");
const injected = source
  .replace("__BUILD_ID__", buildId)
  .replace("const BUILD_ASSETS = [];", `const BUILD_ASSETS = ${JSON.stringify(assets)};`);

if (injected === source || injected.includes("__BUILD_ID__") || injected.includes("const BUILD_ASSETS = [];")) {
  throw new Error("Service worker build markers were not injected");
}

await writeFile(workerPath, injected);
console.info(`Prepared offline shell ${buildId} with ${assets.length} assets`);
