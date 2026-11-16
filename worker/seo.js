import { CITIES, REGIONS } from "./places.js";

/**
 * Per-page SEO.
 *
 * The site is a single-page app: every address gets the same index.html and
 * React fills in the page later. Google and link previews (WhatsApp, Slack…)
 * mostly read that first HTML, so here we fill in the important parts
 * BEFORE it leaves Cloudflare:
 *
 *   <title>, description, canonical address, fi/en alternates, share tags,
 *   and "structured data" (JSON-LD) that tells Google a gym's address,
 *   opening hours and price in a format it understands.
 *
 * pageMeta()  decides WHAT to write for an address (pure data, easy to read).
 * applyMeta() writes it into the HTML with Cloudflare's HTMLRewriter.
 */

const SITE = "https://liikux.fi";
const NOT_A_CHAIN = ["muut", "yksityiset"];

/** 34.9 → "34,9" */
function eur(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))).replace(".", ",");
}

/** "05:00–23:00" → { opens: "05:00", closes: "23:00" }, or null if it is not a simple range. */
function parseHours(text) {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*[–-]\s*(\d{1,2})[:.](\d{2})\s*$/.exec(text ?? "");
  if (!m) return null;
  const pad = (h) => h.padStart(2, "0");
  const closes = m[3] === "24" ? "23:59" : `${pad(m[3])}:${m[4]}`;
  return { opens: `${pad(m[1])}:${m[2]}`, closes };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WEEKEND = ["Saturday", "Sunday"];

/** A gym's own value wins; otherwise the chain's value is used (same rule as the app). */
function gymOffer(gym) {
  const chain = gym.chain ?? {};
  const is247 = gym.is247 ?? chain.is247 ?? null;
  return {
    priceFrom: gym.priceFrom ?? chain.priceFrom ?? null,
    is247: is247 === true,
    hoursWeekday: gym.hoursWeekday || chain.hoursWeekday || null,
    hoursWeekend: gym.hoursWeekend || chain.hoursWeekend || null,
  };
}

function gymMeta(gym, lang, slug) {
  const fi = lang === "fi";
  const offer = gymOffer(gym);
  const chain = gym.chain && !NOT_A_CHAIN.includes(gym.chain.slug) ? gym.chain : null;
  const street = (gym.address || "").split(",")[0].trim();
  const postal = (/\b\d{5}\b/.exec(gym.address || "") || [])[0];
  const where = [street, gym.city].filter(Boolean).join(", ");

  const facts = [];
  if (offer.priceFrom != null) facts.push(fi ? `Jäsenyys alk. ${eur(offer.priceFrom)} €/kk` : `Membership from ${eur(offer.priceFrom)} €/mo`);
  if (offer.is247) facts.push(fi ? "Auki 24/7" : "Open 24/7");
  else if (offer.hoursWeekday) facts.push(fi ? `Auki ma–pe ${offer.hoursWeekday}` : `Open Mon–Fri ${offer.hoursWeekday}`);

  const title = fi
    ? `${gym.name}${gym.city ? `, ${gym.city}` : ""} – hinnat ja aukiolo | Liikux`
    : `${gym.name}${gym.city ? `, ${gym.city}` : ""} – prices and hours | Liikux`;
  const description =
    [where, ...facts].filter(Boolean).join(". ") +
    (fi ? ". Katso hinnat, aukioloajat ja reitti Liikuxissa." : ". See prices, opening hours and route on Liikux.");

  const paths = { fi: `/fi/sali/${slug}`, en: `/en/gym/${slug}` };

  // Structured data: https://schema.org/ExerciseGym
  const hours = [];
  if (offer.is247) {
    hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: [...WEEKDAYS, ...WEEKEND], opens: "00:00", closes: "23:59" });
  } else {
    const wd = parseHours(offer.hoursWeekday);
    const we = parseHours(offer.hoursWeekend);
    if (wd) hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: WEEKDAYS, ...wd });
    if (we) hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: WEEKEND, ...we });
  }
  const gymLd = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: gym.name,
    url: SITE + paths[lang],
    address: {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(postal ? { postalCode: postal } : {}),
      ...(gym.city ? { addressLocality: gym.city } : {}),
      addressCountry: "FI",
    },
    ...(gym.lat != null && gym.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: gym.lat, longitude: gym.lng } } : {}),
    ...(gym.phone ? { telephone: gym.phone } : {}),
    ...(offer.priceFrom != null ? { priceRange: `${fi ? "alk." : "from"} ${eur(offer.priceFrom)} €/${fi ? "kk" : "mo"}` } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(chain ? { brand: { "@type": "Brand", name: chain.name } } : {}),
    ...(gym.www ? { sameAs: [gym.www] } : {}),
  };
  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: fi ? "Kuntosalit" : "Gyms", item: SITE + (fi ? "/fi/kuntosalit" : "/en/gyms") },
      { "@type": "ListItem", position: 2, name: gym.name, item: SITE + paths[lang] },
    ],
  };

  return { title, description, paths, jsonLd: [gymLd, crumbsLd] };
}

/**
 * What to write into the HTML for this address.
 *
 * @param path      e.g. "/fi/sali/elixia-kamppi-123"
 * @param loadJson  (apiPath) => parsed JSON, or null if missing/failed
 * @returns { lang, title?, description?, paths?, jsonLd?, noindex?, status? }
 *          Fields that are left out keep the default from index.html.
 */
export async function pageMeta(path, loadJson) {
  const lang = path === "/en" || path.startsWith("/en/") ? "en" : "fi";
  const fi = lang === "fi";
  let m;

  // Gym page
  if ((m = /^\/(?:fi\/sali|en\/gym)\/([^/]+)$/.exec(path))) {
    const slug = m[1];
    const gym = await loadJson(`/api/gyms/${slug}`);
    if (gym === null) return { lang }; // API problem: do not guess
    if (gym === false) {
      return { lang, status: 404, noindex: true, title: fi ? "Salia ei löytynyt | Liikux" : "Gym not found | Liikux" };
    }
    return { lang, ...gymMeta(gym, lang, slug) };
  }

  // One chain
  if ((m = /^\/(?:fi\/ketju|en\/chain)\/([^/]+)$/.exec(path))) {
    const slug = m[1];
    const chains = await loadJson("/api/chains");
    const chain = Array.isArray(chains) ? chains.find((c) => c.slug === decodeURIComponent(slug)) : null;
    if (!chain) return { lang };
    const n = chain.gymCount ?? 0;
    const price = chain.priceFrom != null ? (fi ? ` Jäsenyys alk. ${eur(chain.priceFrom)} €/kk.` : ` Membership from ${eur(chain.priceFrom)} €/mo.`) : "";
    return {
      lang,
      title: fi ? `${chain.name} – kaikki ${n} salia ja hinnat | Liikux` : `${chain.name} – all ${n} gyms and prices | Liikux`,
      description: fi
        ? `${chain.name}: ${n} kuntosalia ${chain.cityCount ?? ""} kaupungissa.${price} Katso salit kartalla ja vertaa hintoja.`
        : `${chain.name}: ${n} gyms in ${chain.cityCount ?? ""} cities.${price} See the gyms on a map and compare prices.`,
      paths: { fi: `/fi/ketju/${slug}`, en: `/en/chain/${slug}` },
    };
  }

  // All chains
  if (path === "/fi/ketjut" || path === "/en/chains") {
    return {
      lang,
      title: fi ? "Kuntosaliketjut – hinnat ja salit | Liikux" : "Gym chains in Finland – prices and gyms | Liikux",
      description: fi
        ? "Vertaa Suomen kuntosaliketjujen hintoja, jäsenyyksiä, salien määrää ja sijainteja. Katso ketjun kaikki salit kartalla."
        : "Compare prices, memberships, gym counts and locations of gym chains in Finland. See every gym of a chain on the map.",
      paths: { fi: "/fi/ketjut", en: "/en/chains" },
    };
  }

  // About
  if (path === "/fi/tietoa" || path === "/en/about") {
    return {
      lang,
      title: fi
        ? "Tietoa Liikuxista – näin tarkistamme salien hinnat | Liikux"
        : "About Liikux – how we check gym prices | Liikux",
      description: fi
        ? "Liikux näyttää Suomen kuntosalit kartalla hintoineen. Lue, mistä tiedot tulevat, miten ne tarkistetaan ja mitä tehdä, jos jokin on väärin."
        : "Liikux shows gyms in Finland on a map with their prices. Read where the data comes from, how it is checked and what to do if something is wrong.",
      paths: { fi: "/fi/tietoa", en: "/en/about" },
    };
  }

  // City page
  if ((m = /^\/(?:fi\/kuntosalit|en\/gyms)\/([^/]+)\/([^/]+)$/.exec(path))) {
    const paths = { fi: `/fi/kuntosalit/${m[1]}/${m[2]}`, en: `/en/gyms/${m[1]}/${m[2]}` };
    const city = CITIES.find((c) => c[0] === m[1] && c[1] === m[2]);
    if (!city) return { lang, paths };
    const name = city[2];
    const gyms = await loadJson("/api/gyms");
    const count = Array.isArray(gyms) ? gyms.filter((g) => (g.city || "").trim().toLowerCase() === name.toLowerCase()).length : 0;
    const countText = count > 0 ? `${count} ` : "";
    return {
      lang,
      paths,
      title: fi ? `Kuntosalit ${name} – vertaa hintoja kartalla | Liikux` : `Gyms in ${name} – compare prices on a map | Liikux`,
      description: fi
        ? `${name}: ${countText}kuntosalia kartalla. Vertaa hintoja, ilmaisia kokeiluja ja aukioloaikoja ja löydä sali läheltäsi.`
        : `${name}: ${countText}gyms on a map. Compare prices, free trials and opening hours and find a gym near you.`,
    };
  }

  // Region page
  if ((m = /^\/(?:fi\/kuntosalit|en\/gyms)\/([^/]+)$/.exec(path))) {
    const paths = { fi: `/fi/kuntosalit/${m[1]}`, en: `/en/gyms/${m[1]}` };
    const name = REGIONS[m[1]];
    if (!name) return { lang, paths };
    return {
      lang,
      paths,
      title: fi ? `Kuntosalit ${name} – hinnat ja kartta | Liikux` : `Gyms in ${name} – prices and map | Liikux`,
      description: fi
        ? `Maakunnan ${name} kuntosalit kartalla. Vertaa hintoja, ilmaisia kokeiluja ja aukioloaikoja.`
        : `Gyms in the ${name} region on a map. Compare prices, free trials and opening hours.`,
    };
  }

  // All gyms
  if (path === "/fi/kuntosalit" || path === "/en/gyms") {
    return {
      lang,
      paths: { fi: "/fi/kuntosalit", en: "/en/gyms" },
      title: fi ? "Kuntosalit Suomessa – vertaa hintoja kartalla | Liikux" : "Gyms in Finland – compare prices on a map | Liikux",
      description: fi
        ? "Selaa Suomen kuntosaleja kartalla ja listalla. Vertaa hintoja, ilmaisia kokeiluja ja aukioloaikoja."
        : "Browse gyms in Finland on a map and in a list. Compare prices, free trials and opening hours.",
    };
  }

  // Front page
  if (path === "/" || path === "/en") {
    const site = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Liikux",
      url: SITE + "/",
      inLanguage: ["fi", "en"],
    };
    if (fi) return { lang, paths: { fi: "/", en: "/en" }, jsonLd: [site] };
    return {
      lang,
      paths: { fi: "/", en: "/en" },
      jsonLd: [site],
      title: "Liikux – compare gyms, prices and free trials in Finland",
      description: "Compare prices, free trials and opening hours of over 1,000 gyms in Finland on a map – Liikux.",
    };
  }

  // Personal or internal pages: keep them out of Google.
  if (/^\/(fi\/suosikit|en\/favorites|admin)(\/|$)/.test(path)) return { lang, noindex: true };

  return { lang };
}

/** Write the meta into the HTML response. */
export function applyMeta(response, meta, path) {
  const canonical = SITE + (meta.paths ? meta.paths[meta.lang] : path);
  const setContent = (value) => ({
    element(el) {
      if (value) el.setAttribute("content", value);
    },
  });

  let extra = "";
  if (meta.paths) {
    extra += `<link rel="alternate" hreflang="fi" href="${SITE + meta.paths.fi}" />`;
    extra += `<link rel="alternate" hreflang="en" href="${SITE + meta.paths.en}" />`;
    extra += `<link rel="alternate" hreflang="x-default" href="${SITE + meta.paths.fi}" />`;
  }
  if (meta.noindex) extra += `<meta name="robots" content="noindex" />`;
  for (const data of meta.jsonLd ?? []) {
    // "<" is escaped so nothing in the data can close the <script> tag.
    extra += `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
  }

  const rewritten = new HTMLRewriter()
    .on("html", {
      element(el) {
        el.setAttribute("lang", meta.lang);
      },
    })
    .on("title", {
      element(el) {
        if (meta.title) el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', setContent(meta.description))
    .on('meta[property="og:title"]', setContent(meta.title))
    .on('meta[property="og:description"]', setContent(meta.description))
    .on('meta[property="og:url"]', setContent(canonical))
    .on('meta[property="og:locale"]', setContent(meta.lang === "en" ? "en_GB" : "fi_FI"))
    .on('meta[name="twitter:title"]', setContent(meta.title))
    .on('meta[name="twitter:description"]', setContent(meta.description))
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute("href", canonical);
      },
    })
    .on("head", {
      element(el) {
        if (extra) el.append(extra, { html: true });
      },
    })
    .transform(response);

  return meta.status ? new Response(rewritten.body, { status: meta.status, headers: rewritten.headers }) : rewritten;
}
