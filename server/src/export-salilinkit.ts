import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../../client/public/salilinkit.html");

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const chainRows = await db.select().from(chains);
  const byId = new Map(chainRows.map((c) => [c.id, c]));

  const rows = await db.select().from(gyms).where(eq(gyms.listed, true));
  const withWww = rows
    .filter((g) => (g.www ?? "").trim())
    .sort((a, b) => a.name.localeCompare(b.name, "fi"));

  const items = withWww
    .map((g) => {
      const chain = byId.get(g.chainId);
      const chainName = chain?.name ?? "?";
      const www = (g.www ?? "").trim();
      return `<li>
  <strong>${esc(g.name)}</strong>
  <span class="meta">${esc(g.city)} · ${esc(chainName)}</span>
  <a href="${esc(www)}" target="_blank" rel="noreferrer">${esc(www)}</a>
</li>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liikux salilinkit (${withWww.length})</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; background: #0f172a; color: #e2e8f0; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #94a3b8; margin: 0 0 1.25rem; }
    input { width: min(28rem, 100%); padding: 0.55rem 0.75rem; border-radius: 0.5rem; border: 1px solid #334155; background: #1e293b; color: #fff; margin-bottom: 1rem; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.65rem; }
    li { background: #1e293b; border: 1px solid #334155; border-radius: 0.65rem; padding: 0.75rem 0.9rem; display: grid; gap: 0.25rem; }
    .meta { color: #94a3b8; font-size: 0.85rem; }
    a { color: #facc15; word-break: break-all; }
    .hide { display: none; }
  </style>
</head>
<body>
  <h1>Salilinkit — ${withWww.length} kpl</h1>
  <p>Klikkaa linkkiä. Tämä sivu on vain tarkistukseen (ei osa tuotetta).</p>
  <input id="q" type="search" placeholder="Suodata nimellä, kaupungilla tai ketjulla…" />
  <ul id="list">
${items}
  </ul>
  <script>
    const q = document.getElementById("q");
    const list = document.getElementById("list");
    q.addEventListener("input", () => {
      const v = q.value.trim().toLowerCase();
      for (const li of list.children) {
        const t = li.textContent.toLowerCase();
        li.classList.toggle("hide", v && !t.includes(v));
      }
    });
  </script>
</body>
</html>
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
  console.log(`Wrote ${withWww.length} links → ${outPath}`);
  console.log("Open: http://localhost:5173/salilinkit.html");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
