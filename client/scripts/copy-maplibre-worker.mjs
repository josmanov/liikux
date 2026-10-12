import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const out = join(root, "public", "maplibre");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(out, { recursive: true });

for (const name of files) {
  const from = join(dist, name);
  if (!existsSync(from)) {
    console.error(`[copy-maplibre-worker] missing ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(out, name));
  console.log(`[copy-maplibre-worker] ${name}`);
}
