import { CITIES, REGIONS, STATIC_PAGES } from "./places.js";

/**
 * /sitemap.xml: the list of pages we want Google to know about.
 *
 * Built from the real data: every gym and every chain from the API, plus the
 * fixed pages, regions and cities, each in Finnish and English.
 * If the API cannot be reached we still return the fixed pages, so the
 * sitemap never breaks.
 */

const SITE = "https://liikux.fi";
const NOT_A_CHAIN = ["muut", "yksityiset"];

function xmlSafe(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One <url> with links to both language versions (helps Google pair them). */
function entry(fiPath, enPath) {
  const fi = xmlSafe(SITE + fiPath);
  const en = xmlSafe(SITE + enPath);
  const alternates =
    `<xhtml:link rel="alternate" hreflang="fi" href="${fi}"/>` +
    `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>`;
  return `<url><loc>${fi}</loc>${alternates}</url>\n<url><loc>${en}</loc>${alternates}</url>`;
}

/**
 * @param loadJson  (apiPath) => parsed JSON or null. Given by worker.js.
 * @returns { xml, complete }  complete = false when gyms/chains were missing.
 */
export async function buildSitemap(loadJson) {
  const [gyms, chains] = await Promise.all([loadJson("/api/gyms"), loadJson("/api/chains")]);
  const rows = [];

  for (const [fi, en] of STATIC_PAGES) rows.push(entry(fi, en));
  for (const region of Object.keys(REGIONS)) {
    rows.push(entry(`/fi/kuntosalit/${region}`, `/en/gyms/${region}`));
  }
  for (const [region, city] of CITIES) {
    rows.push(entry(`/fi/kuntosalit/${region}/${city}`, `/en/gyms/${region}/${city}`));
  }

  if (Array.isArray(chains)) {
    for (const chain of chains) {
      if (!chain.slug || NOT_A_CHAIN.includes(chain.slug) || !chain.gymCount) continue;
      const slug = encodeURIComponent(chain.slug);
      rows.push(entry(`/fi/ketju/${slug}`, `/en/chain/${slug}`));
    }
  }

  if (Array.isArray(gyms)) {
    for (const gym of gyms) {
      if (!gym.slug || gym.listed === false) continue;
      const slug = encodeURIComponent(gym.slug);
      rows.push(entry(`/fi/sali/${slug}`, `/en/gym/${slug}`));
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    rows.join("\n") +
    `\n</urlset>\n`;

  return { xml, complete: Array.isArray(gyms) && Array.isArray(chains) };
}
