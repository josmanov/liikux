import "dotenv/config";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../../client/public/data-review.html");

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(ok: boolean, text: string) {
  return `<td class="${ok ? "ok" : "miss"}">${esc(text)}</td>`;
}

async function main() {
  const chainRows = await db.select().from(chains);
  const gymRows = await db.select().from(gyms);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));

  const listed = gymRows.filter((g) => g.listed);
  let missPrice = 0;
  let missHours = 0;
  let missWww = 0;

  const bodyRows: string[] = [];
  for (const g of listed.sort((a, b) => a.name.localeCompare(b.name, "fi"))) {
    const chain = chainById.get(g.chainId);
    const mode = chain?.pricingMode ?? "?";
    const price =
      g.priceFrom != null
        ? g.priceFrom
        : mode === "shared" || mode === "hybrid"
          ? chain?.priceFrom
          : null;
    const hours =
      g.hoursWeekday ||
      (g.is247 ? "24/7" : null) ||
      (mode === "shared" ? chain?.hoursWeekday : null);
    const hasPrice = price != null;
    const hasHours = Boolean(hours);
    const hasWww = Boolean(g.www);
    if (!hasPrice) missPrice++;
    if (!hasHours) missHours++;
    if (!hasWww) missWww++;

    bodyRows.push(`<tr>
      <td>${esc(chain?.name ?? g.chainId)}</td>
      <td>${esc(mode)}</td>
      <td>${esc(g.name)}</td>
      <td>${esc(g.city)}</td>
      ${cell(hasPrice, hasPrice ? String(price) : "EI TIEDOSSA")}
      ${cell(hasHours, hasHours ? String(hours) : "EI TIEDOSSA")}
      ${cell(hasWww, hasWww ? "www ok" : "ei www")}
      <td>${g.www ? `<a href="${esc(g.www)}" target="_blank" rel="noreferrer">avaa</a>` : "-"}</td>
    </tr>`);
  }

  const html = `<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liikux data-review</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; background: #111; color: #eee; }
    h1 { margin: 0 0 .5rem; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0 1.5rem; }
    .stats div { background: #1c1c1c; padding: .75rem 1rem; border-radius: 10px; }
    .miss-n { color: #ff8b8b; font-weight: 700; }
    .ok-n { color: #8dffb0; font-weight: 700; }
    .toolbar { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
    input { width: min(420px, 100%); padding: .6rem .8rem; border-radius: 8px; border: 0; background: #222; color: #eee; }
    label { display: flex; gap: .4rem; align-items: center; color: #ccc; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #333; padding: .45rem .5rem; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; background: #1a1a1a; }
    td.ok { color: #8dffb0; }
    td.miss { color: #ff8b8b; font-weight: 600; }
    a { color: #9ecbff; }
    .note { color: #aaa; margin-bottom: 1rem; max-width: 70ch; }
  </style>
</head>
<body>
  <h1>Liikux data-review</h1>
  <p class="note">Vain localhost / kehitys. Vihreä = ok, punainen = puuttuu. Hinta: sali ensin, sitten ketju jos mode shared/hybrid. Mode: location = salikohtainen, shared = ketjun hinnasto, hybrid = molemmat.</p>
  <div class="stats">
    <div>Saleja listalla: <span class="ok-n">${listed.length}</span></div>
    <div>Puuttuva hinta: <span class="miss-n">${missPrice}</span></div>
    <div>Puuttuva aukiolo: <span class="miss-n">${missHours}</span></div>
    <div>Puuttuva www: <span class="miss-n">${missWww}</span></div>
  </div>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Suodata nimellä / ketjulla / kaupungilla..." />
    <label><input id="hideMuut" type="checkbox" checked /> Piilota Muut</label>
    <label><input id="onlyMiss" type="checkbox" /> Vain puuttuvat hinnat</label>
  </div>
  <table>
    <thead>
      <tr>
        <th>Ketju</th><th>Mode</th><th>Sali</th><th>Kaupunki</th>
        <th>Hinta</th><th>Aukiolo</th><th>WWW</th><th>Linkki</th>
      </tr>
    </thead>
    <tbody id="rows">
      ${bodyRows.join("\n")}
    </tbody>
  </table>
  <script>
    const q = document.getElementById('q');
    const hideMuut = document.getElementById('hideMuut');
    const onlyMiss = document.getElementById('onlyMiss');
    const rows = [...document.querySelectorAll('#rows tr')];
    function apply() {
      const v = q.value.trim().toLowerCase();
      for (const tr of rows) {
        const text = tr.textContent.toLowerCase();
        const chain = (tr.children[0]?.textContent || '').trim();
        const priceMiss = tr.children[4]?.classList.contains('miss');
        let show = !v || text.includes(v);
        if (hideMuut.checked && chain === 'Muut') show = false;
        if (onlyMiss.checked && !priceMiss) show = false;
        tr.style.display = show ? '' : 'none';
      }
    }
    q.addEventListener('input', apply);
    hideMuut.addEventListener('change', apply);
    onlyMiss.addEventListener('change', apply);
    apply();
  </script>
</body>
</html>`;

  writeFileSync(outPath, html, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    `listed=${listed.length} missPrice=${missPrice} missHours=${missHours} missWww=${missWww}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
