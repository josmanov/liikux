import fs from "fs";

const regions = [
  "uusimaa",
  "varsinaissuomi",
  "satakunta",
  "kanta-hame",
  "pirkanmaa",
  "paijat-hame",
  "kymenlaakso",
  "etela-karjala",
  "etela-savo",
  "pohjois-savo",
  "pohjois-karjala",
  "keski-suomi",
  "etela-pohjanmaa",
  "pohjanmaa",
  "keski-pohjanmaa",
  "pohjois-pohjanmaa",
  "kainuu",
  "lappi",
  "ahvenanmaa",
];

const cityRegion = [
  ["uusimaa", "helsinki"],
  ["uusimaa", "espoo"],
  ["uusimaa", "vantaa"],
  ["uusimaa", "porvoo"],
  ["uusimaa", "lohja"],
  ["uusimaa", "hyvinkaa"],
  ["uusimaa", "kerava"],
  ["uusimaa", "jarvenpaa"],
  ["uusimaa", "kirkkonummi"],
  ["pirkanmaa", "tampere"],
  ["varsinaissuomi", "turku"],
  ["varsinaissuomi", "salo"],
  ["pohjois-pohjanmaa", "oulu"],
  ["keski-suomi", "jyvaskyla"],
  ["pohjois-savo", "kuopio"],
  ["paijat-hame", "lahti"],
  ["kymenlaakso", "kouvola"],
  ["kymenlaakso", "kotka"],
  ["satakunta", "pori"],
  ["pohjois-karjala", "joensuu"],
  ["etela-karjala", "lappeenranta"],
  ["kanta-hame", "hameenlinna"],
  ["kanta-hame", "riihimaki"],
  ["pohjanmaa", "vaasa"],
  ["etela-pohjanmaa", "seinajoki"],
  ["lappi", "rovaniemi"],
  ["etela-savo", "mikkeli"],
];

function urls(list) {
  return list.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
}

const locs = [
  "https://liikux.fi/",
  "https://liikux.fi/en",
  "https://liikux.fi/fi/kuntosalit",
  "https://liikux.fi/en/gyms",
  ...regions.map((s) => `https://liikux.fi/fi/kuntosalit/${s}`),
  ...regions.map((s) => `https://liikux.fi/en/gyms/${s}`),
  ...cityRegion.map(
    ([r, c]) => `https://liikux.fi/fi/kuntosalit/${r}/${c}`,
  ),
  ...cityRegion.map(([r, c]) => `https://liikux.fi/en/gyms/${r}/${c}`),
  "https://liikux.fi/fi/kayttoehdot",
  "https://liikux.fi/fi/tietosuoja",
  "https://liikux.fi/fi/evasteet",
  "https://liikux.fi/en/terms",
  "https://liikux.fi/en/privacy",
  "https://liikux.fi/en/cookies",
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls(locs)}
</urlset>
`;

fs.writeFileSync("client/public/sitemap.xml", xml);

const worker = fs.readFileSync("worker.js", "utf8");
const next = worker.replace(
  /const SITEMAP = `[\s\S]*?`;/,
  `const SITEMAP = \`${xml.trim()}\n\`;`,
);
fs.writeFileSync("worker.js", next);
console.log("sitemap urls", locs.length);
