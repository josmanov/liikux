import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const strict = process.argv.includes("--strict");
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx|css)$/.test(file));

function countLines(file) {
  const text = readFileSync(file, "utf8");
  if (!text) return 0;
  return text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
}

const rows = files.map((file) => {
  const lines = countLines(file);
  const limit = /(^|\/)pages\//.test(file) ? 350 : 300;
  return { file, lines, limit, over: lines > limit };
});

const over = rows
  .filter((row) => row.over)
  .sort((a, b) => b.lines - a.lines);

console.log(`Checked ${rows.length} tracked TS/TSX/CSS files.`);
console.log(`Over the project target (300 lines, 350 for pages): ${over.length}`);
console.log("");

for (const row of over) {
  console.log(`${String(row.lines).padStart(5)}  limit ${row.limit}  ${row.file}`);
}

if (over.length === 0) {
  console.log("All files are within the target.");
}

if (strict && over.length > 0) {
  process.exitCode = 1;
}
