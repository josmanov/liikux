const LINK_KEYWORDS =
  /hinnasto|hinnat|hinta|jäsenyy|jasenyy|jasenyys|hanki|liity|asiakkuu|membership|prices|pricing|aukiolo|avoinna|kortit|salikortti|treenaa|verkkokauppa|osta/i;

const SKIP_LINK =
  /mailto:|tel:|javascript:|\.pdf$|\.jpg|\.png|\.svg|facebook|instagram|youtube|linkedin|tiktok|wp-login|\/feed\/?$|\?share=|\/tag\/|\/author\//i;

export function guessedOfferPaths(baseWww: string | null): string[] {
  if (!baseWww) return [];
  try {
    const u = new URL(baseWww.includes("://") ? baseWww : `https://${baseWww}`);
    const origin = u.origin;
    const paths = [
      "/hinnasto/",
      "/hinnasto",
      "/hinnat/",
      "/hinnat",
      "/jasenyys/",
      "/jasenyys",
      "/jäsenyys/",
      "/membership/",
      "/aukioloajat/",
      "/aukioloajat",
      "/prices/",
      "/pricing/",
    ];
    return paths.map((p) => origin + p);
  } catch {
    return [];
  }
}

export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripChainPrefix(name: string, prefixes: RegExp) {
  return name.replace(prefixes, "").trim();
}

export function chainPatternUrls(chainId: string, gymName: string): string[] {
  const out: string[] = [];
  if (chainId === "c8") {
    const slug = slugifyName(stripChainPrefix(gymName, /^ladyline\s*/i));
    if (slug) {
      out.push(`https://ladyline.fi/toimipiste/${slug}/`);
      out.push(`https://ladyline.fi/toimipiste/${slug}/hanki-jasenyys/`);
    }
  }
  if (chainId === "c3") {
    const bare = stripChainPrefix(gymName, /^fressi\s*(24h)?\s*/i);
    const slug = slugifyName(bare);
    if (slug) {
      out.push(`https://www.fressi.fi/toimipisteet/${slug}/`);
      out.push(`https://www.fressi.fi/toimipisteet/fressi-kuntosali-${slug}/`);
    }
  }
  if (chainId === "c7") {
    const slug = slugifyName(
      stripChainPrefix(gymName, /^forever\s*(kuntoklubi)?\s*/i),
    );
    if (slug) out.push(`https://www.foreverclub.fi/toimipisteet/${slug}/`);
  }
  if (chainId === "c2") {
    const slug = slugifyName(stripChainPrefix(gymName, /^elixia\s*/i));
    if (slug) out.push(`https://www.elixia.fi/kuntokeskus/${slug}`);
  }
  if (chainId === "c1") {
    const slug = slugifyName(stripChainPrefix(gymName, /^easyfit\s*/i));
    if (slug) out.push(`https://www.easyfit.fi/kuntokeskukset/${slug}/`);
  }
  return out;
}

export function sameHost(a: string, b: string) {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "");
    const hb = new URL(b).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

export function findCandidateLinks(html: string, baseUrl: string, max = 6) {
  const found: { url: string; score: number }[] = [];
  const seen = new Set<string>();
  const re = /<a\b([^>]*)href\s*=\s*["']([^"'#]+)[^"']*["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = `${m[1] ?? ""} ${m[3] ?? ""}`;
    const href = (m[2] ?? "").trim();
    const text = (m[4] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!href || SKIP_LINK.test(href)) continue;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    abs = abs.replace(/#.*$/, "");
    if (!sameHost(abs, baseUrl)) continue;
    if (abs === baseUrl.replace(/#.*$/, "")) continue;
    if (seen.has(abs)) continue;
    const hay = `${href} ${text} ${attrs}`;
    if (!LINK_KEYWORDS.test(hay)) continue;
    seen.add(abs);
    let score = 0;
    if (/hinnasto|hinnat|prices|pricing/i.test(hay)) score += 5;
    if (/jäsenyy|jasenyy|membership|hanki|liity|asiakkuu/i.test(hay)) score += 4;
    if (/aukiolo|avoinna/i.test(hay)) score += 2;
    if (/kortit|salikortti|treenaa|verkkokauppa|osta/i.test(hay)) score += 1;
    found.push({ url: abs, score });
  }
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((f) => f.url);
}
