import { htmlToText } from "./fetchPage.js";

export type Membership = { name: string; priceEur: number; note?: string };

export type Extracted = {
  priceFrom: number | null;
  priceLabel: string | null;
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  is247: boolean | null;
  memberships: Membership[] | null;
};

export function emptyExtracted(): Extracted {
  return {
    priceFrom: null,
    priceLabel: null,
    hoursWeekday: null,
    hoursWeekend: null,
    is247: null,
    memberships: null,
  };
}

function parseEuro(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function hhmm(h: string | undefined, m?: string | null) {
  const hour = (h ?? "0").padStart(2, "0");
  const min = m && m.length === 2 ? m : "00";
  return `${hour}:${min}`;
}

const DISCOUNT_CONTEXT =
  /opiskelij|eläkel|elakel|nuoriso|seniorihinta|online[\s-]?hinta|kertak|kertamaksu|päiväkortti|paivakortti|kampanj|tarjou|ensimmäi|1\.\s*kk|aloitusmaksu|liittymismaksu|tauko|lapsi|juniori|varusmie|työttöm|tyottom|per\s*viikko|\/\s*vko\b(?!\s*4)/i;

function isDiscountPrice(ctx: string, matched: string) {
  const m = matched.toLowerCase();
  if (/^\s*\*/.test(matched)) return true;
  if (/opiskelij|eläkel|työttöm|seniorihinta|kampanj|tarjou|kertak|1\.\s*kk|aloitus/i.test(m)) {
    return true;
  }
  const idx = ctx.indexOf(matched);
  const before = ctx.slice(0, Math.max(0, idx)).slice(-25);
  const after = ctx.slice(Math.max(0, idx) + matched.length).slice(0, 70);
  if (/\*\s*$/.test(before)) return true;
  if (/(?:opiskelij|eläkel|työttöm)\w*\s*$/i.test(before)) return true;
  if (/(?:opiskelij|eläkel|työttöm|senior)/i.test(after)) return true;
  return false;
}

function pickPrice(
  cands: { price: number; ctx: string; label?: string; matched?: string }[],
  min = 15,
  max = 200,
) {
  const ok = cands.filter((c) => {
    if (c.price < min || c.price > max) return false;
    if (isDiscountPrice(c.ctx, c.matched ?? "")) return false;
    return true;
  });
  if (!ok.length) return null;
  ok.sort((a, b) => a.price - b.price);
  return ok[0];
}

export function extractElixia(html: string): Extracted {
  const out = emptyExtracted();
  const priceCard = html.match(
    /pricing-card__price[\s\S]{0,240}?>(\d{1,3}[.,]\d{2})</i,
  );
  out.priceFrom = priceCard ? parseEuro(priceCard[1]) : null;
  if (out.priceFrom != null) {
    out.priceLabel = "Basic (tämä keskus)";
    out.memberships = [
      { name: "Basic", priceEur: out.priceFrom, note: "EUR/kk, tämä keskus" },
    ];
  }
  const hoursBlock = html.match(
    /(?:id="opening-hours"|Aukioloajat|Kapasiteetti)[\s\S]{0,900}?Keskus[\s\S]{0,200}?(?:Ma\s*[-–]\s*Su|Ma\s*[-–]\s*To|Ma\s*[-–]\s*Pe)[\s\S]{0,120}?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i,
  );
  if (hoursBlock) {
    out.hoursWeekday = `${hoursBlock[1]}–${hoursBlock[2]}`;
    out.hoursWeekend = out.hoursWeekday;
    out.is247 = false;
  } else {
    const simple = html.match(
      /avoinna joka päivä klo\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/i,
    );
    if (simple) {
      out.hoursWeekday = `${hhmm(simple[1])}–${hhmm(simple[2])}`;
      out.hoursWeekend = out.hoursWeekday;
      out.is247 = false;
    }
  }
  return out;
}

export function extractEasyFit(html: string): Extracted {
  const out = emptyExtracted();
  const price =
    html.match(/alkaen\s+(\d{1,3}[.,]\d{2})\s*€/i) ||
    html.match(/Basic\s+(\d{1,3}[.,]\d{2})\s*€/i) ||
    html.match(/>(\d{1,3}[.,]\d{2})\s*€\/kk</i);
  out.priceFrom = price ? parseEuro(price[1]) : null;
  if (out.priceFrom != null) {
    out.priceLabel = "Basic";
    out.memberships = [{ name: "Basic", priceEur: out.priceFrom, note: "EUR/kk" }];
  }
  if (/24\s*\/\s*7|kulkukortilla\s*24/i.test(html)) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  } else {
    const h = html.match(
      /Aukioloajat[\s\S]{0,120}?(\d{1,2})\s*[–-]\s*(\d{1,2}|24)/i,
    );
    if (h) {
      out.hoursWeekday = `${hhmm(h[1])}–${h[2] === "24" ? "24:00" : hhmm(h[2])}`;
      out.hoursWeekend = out.hoursWeekday;
      out.is247 = false;
    }
  }
  return out;
}

export function extractForever(html: string): Extracted {
  const out = emptyExtracted();
  const basic12 = html.match(
    /Basic[\s\S]{0,800}?12\s*kk[\s\S]{0,400}?<strong>(\d{1,3}[.,]\d{2})\s*€<\/strong>/i,
  );
  let price = basic12 ? parseEuro(basic12[1]) : null;
  if (price != null && (price < 27 || price > 45)) price = null;
  const flexMatches = [
    ...html.matchAll(
      /Basic[\s\S]{0,400}?Toistaiseksi voimassa[\s\S]{0,400}?<strong>(\d{1,3}[.,]\d{2})\s*€<\/strong>/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 30 && n <= 50);
  const flex = flexMatches.length ? Math.max(...flexMatches) : null;
  if (price != null) {
    out.priceFrom = price;
    out.priceLabel = "Basic 12 kk (4 vko)";
    out.memberships = [
      { name: "Basic 12 kk", priceEur: price, note: "EUR / 4 vko, normaalihinta" },
    ];
    if (flex != null) {
      out.memberships.push({
        name: "Basic joustava",
        priceEur: flex,
        note: "EUR / 4 vko",
      });
    }
  }
  const memberBlock = html.match(/Avoinna jäsenille:([\s\S]{0,900}?)(?:Asiakaspalvelu|$)/i);
  const memberText = memberBlock ? memberBlock[1] ?? "" : "";
  const open247 = /24\s*\/\s*7|24h|ympäri vuorokauden/i.test(memberText);
  const openKlo = memberText.match(
    /(?:klo\s*)?(\d{1,2})[.:](\d{2})\s*[\u2013\u2014\-–]\s*(\d{1,2})[.:](\d{2})/i,
  );
  const openMa = memberText.match(
    /Ma[\s\u2013\u2014\-–]*(?:to|pe|su)\s*(\d{1,2})[.:]?(\d{2})?\s*[\u2013\u2014\-–]\s*(\d{1,2})/i,
  );
  if (open247) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  } else if (openKlo) {
    out.hoursWeekday = `${hhmm(openKlo[1], openKlo[2])}–${hhmm(openKlo[3], openKlo[4])}`;
    out.hoursWeekend = out.hoursWeekday;
    out.is247 = false;
  } else if (openMa) {
    out.hoursWeekday = `${hhmm(openMa[1], openMa[2])}–${hhmm(openMa[3])}`;
    out.hoursWeekend = out.hoursWeekday;
    out.is247 = false;
  }
  return out;
}

export function extractFressi(html: string): Extracted {
  const out = emptyExtracted();
  const ranges = [
    ...html.matchAll(
      /uabb-pricing-table-price[^>]*>\s*(\d{1,3}[.,]\d{2})\s*€\s*[-–]\s*(\d{1,3}[.,]\d{2})\s*€/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 35 && n <= 90);
  if (ranges.length) {
    out.priceFrom = Math.min(...ranges);
    out.priceLabel = "Asiakkuus alkaen";
    out.memberships = [
      {
        name: "Asiakkuus alkaen",
        priceEur: out.priceFrom,
        note: "EUR/kk, riippuu sitoutumisesta",
      },
    ];
  }
  if (/avoinna\s*24\s*h|24\s*h\s*joka|24\s*\/\s*7/i.test(html)) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  } else {
    const h = html.match(/avoinna\s+klo\s+(\d{1,2})\s*[–-]\s*(\d{1,2})/i);
    if (h) {
      out.hoursWeekday = `${hhmm(h[1])}–${hhmm(h[2])}`;
      out.hoursWeekend = out.hoursWeekday;
      out.is247 = false;
    }
  }
  return out;
}

export function extractOleFit(html: string): Extracted {
  const out = emptyExtracted();
  const cards = [
    ...html.matchAll(
      /<h2>\s*(\d{1,3}[.,]\d{2})\s*€\s*<\/h2>\s*<h4>\s*\/\s*4\s*viikkoa/gi,
    ),
  ].map((m) => ({
    price: parseEuro(m[1]) ?? 0,
    ctx: html.slice(Math.max(0, (m.index ?? 0) - 200), m.index ?? 0),
  }));
  const legacy = [
    ...html.matchAll(
      /(\d{1,3}[.,]\d{2})\s*(?:€|&euro;)[\s\S]{0,80}?(?:\/\s*4\s*vko|\/\s*4\s*viikkoa)/gi,
    ),
  ].map((m) => ({
    price: parseEuro(m[1]) ?? 0,
    ctx: html.slice(Math.max(0, (m.index ?? 0) - 200), m.index ?? 0),
  }));
  const best = pickPrice([...cards, ...legacy], 35, 120);
  if (best) {
    out.priceFrom = best.price;
    out.priceLabel = "Jäsenyys (4 vko)";
    out.memberships = [
      { name: "Jäsenyys", priceEur: best.price, note: "EUR / 4 vko" },
    ];
  }
  if (/24\s*\/\s*7/i.test(html)) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  } else if (/05\s*[–-]\s*24|klo\s*05/i.test(html)) {
    out.hoursWeekday = "05:00–24:00";
    out.hoursWeekend = "05:00–24:00";
    out.is247 = false;
  }
  return out;
}

export function extractLadyLine(html: string): Extracted {
  const out = emptyExtracted();
  const cands = [
    ...html.matchAll(/class="price">\s*(\d{1,3}[.,]\d{2})\s*€/gi),
  ].map((m) => ({
    price: parseEuro(m[1]) ?? 0,
    ctx: html.slice(Math.max(0, (m.index ?? 0) - 160), (m.index ?? 0) + 40),
  }));
  const best = pickPrice(cands, 35, 90);
  if (best) {
    out.priceFrom = best.price;
    out.priceLabel = "Jäsenyys alkaen";
    out.memberships = [{ name: "Jäsenyys alkaen", priceEur: best.price }];
  }
  if (/24\s*\/\s*7|avoinna 24/i.test(html)) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  } else {
    const key =
      html.match(
        /(?:avoinna\s+)?(?:kulkuavaimella|jäsenille|jäsenillä|kuntosali(?:lla)?)[\s\S]{0,60}?joka\s*päivä\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
      ) ||
      html.match(
        /joka\s*päivä\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
      ) ||
      html.match(
        /(?:koko\s*päivä|avoinna)\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
      ) ||
      html.match(/05\s*[-–]\s*23|04\s*[-–]\s*24|06\s*[-–]\s*23/i);
    if (key) {
      if (key.length >= 4 && key[1] != null) {
        out.hoursWeekday = `${hhmm(key[1], key[2])}–${hhmm(key[3], key[4])}`;
      } else if (/05\s*[-–]\s*23/i.test(key[0] ?? "")) {
        out.hoursWeekday = "05:00–23:00";
      } else if (/04\s*[-–]\s*24/i.test(key[0] ?? "")) {
        out.hoursWeekday = "04:00–24:00";
      } else if (/06\s*[-–]\s*23/i.test(key[0] ?? "")) {
        out.hoursWeekday = "06:00–23:00";
      }
      if (out.hoursWeekday) {
        out.hoursWeekend = out.hoursWeekday;
        out.is247 = false;
      }
    }
  }
  return out;
}

export function extractGeneric(html: string): Extracted {
  const out = emptyExtracted();
  let text = htmlToText(html);
  text = text
    .replace(/€\s*(\d{1,3})\s+(\d{2})(?!\d)/g, "€$1,$2")
    .replace(/(\d{1,3})\s+(\d{2})\s*€/g, "$1,$2 €")
    .replace(/&euro;/gi, "€");

  const priceRes = [
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*\/\s*\*\s*\d/gi,
    /kuukausi(?:kortti)?\D{0,25}(\d{1,3}(?:[.,]\d{1,2})?)\s*€/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*\/\s*(?:kk|kuukausi)\b/gi,
    /€\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*\/\s*(?:kk|kuukausi)\b/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*\/\s*(?:kuukaudessa|kk:ssa)/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*(?:\/|per)\s*4\s*(?:vko|viikkoa)/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur)\s*kuukaudessa/gi,
    /(?:kuukausikortti|kuukausijäsenyys|kk-kortti|kk-jäsenyys|jäsenyys|asiakkuus)\D{0,50}?(\d{1,3}(?:[.,]\d{1,2})?)\s*€/gi,
    /(?:kuukausikortti|jäsenyys|asiakkuus)\D{0,50}?€\s*(\d{1,3}(?:[.,]\d{1,2})?)/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*\/\s*(?:kk|kuukausi)\s*\(?\s*(?:12|24)\s*kk/gi,
    /alkaen\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*€/gi,
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*(?:\/\s*)?(?:kk|kuukausi)/gi,
  ];

  const cands: { price: number; ctx: string; label?: string; matched?: string }[] = [];
  for (const re of priceRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const p = parseEuro(m[1]);
      if (p == null) continue;
      const start = Math.max(0, m.index - 80);
      const ctx = text.slice(start, m.index + m[0].length + 40);
      if (/kertak|10\s*x|10x|päiväkortti|3\s*kuukautta|6\s*kuukautta|12\s*kuukautta|vuosi|vuosikortti/i.test(ctx) &&
          !/kuukausi(?:kortti)?/i.test(m[0]) &&
          !/\/\s*kk|\/\s*kuukausi|4\s*(?:vko|viikkoa)/i.test(m[0])) {
        if (/3\s*kuukautta|6\s*kuukautta|12\s*kuukautta|vuosikortti|10\s*x|kertak/i.test(ctx.slice(0, 40))) {
          continue;
        }
      }
      const label = /4\s*(?:vko|viikkoa)/i.test(m[0]) ? "4 vko" : "kk";
      cands.push({ price: p, ctx, label, matched: m[0] });
    }
  }

  const monthBlocks = [
    ...text.matchAll(
      /kuukausi(?:kortti)?\s*[:\-]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*€(?:\s*\/\s*\*\s*\d{1,3}(?:[.,]\d{1,2})?\s*€?)?/gi,
    ),
    ...text.matchAll(
      /(\d{1,2})\s*kk\s*-?\s*kortti\D{0,40}?(\d{1,3}(?:[.,]\d{1,2})?)\s*€/gi,
    ),
  ];
  for (const m of monthBlocks) {
    const raw = m[2] ?? m[1];
    const p = parseEuro(raw);
    if (p == null) continue;
    if (m[2] != null && Number(m[1]) !== 1) continue;
    const start = Math.max(0, m.index ?? 0);
    const ctx = text.slice(Math.max(0, start - 60), start + m[0].length + 40);
    cands.push({ price: p, ctx, label: "kk", matched: m[0] });
  }

  const euroFirst = [
    ...text.matchAll(/€\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*€?\s*\/\s*kuukausi/gi),
    ...text.matchAll(/€(\d{1,3}(?:[.,]\d{1,2})?)\s*€?\s*\/\s*kuukausi/gi),
    ...text.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*\/\s*kuukausi/gi),
  ];
  for (const m of euroFirst) {
    const p = parseEuro(m[1]);
    if (p == null) continue;
    const start = Math.max(0, m.index ?? 0);
    const ctx = text.slice(Math.max(0, start - 80), start + m[0].length + 40);
    cands.push({ price: p, ctx, label: "kk", matched: m[0] });
  }

  const best = pickPrice(cands, 12, 200);
  if (best) {
    out.priceFrom = best.price;
    out.priceLabel =
      best.label === "4 vko" ? "Jäsenyys alkaen (4 vko)" : "Jäsenyys alkaen";
    out.memberships = [
      {
        name: "Jäsenyys alkaen",
        priceEur: best.price,
        note: best.label === "4 vko" ? "EUR / 4 vko" : "EUR/kk",
      },
    ];
  }

  if (
    /24\s*\/\s*7|\b24\s*h\b|ympäri vuorokauden|avoinna 24|24 tuntia|kellon ympäri|joka päivä 24/i.test(
      text,
    )
  ) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
    return out;
  }

  const gymAccess =
    text.match(
      /(?:kulkuavaimella|jäsenille|jäsenillä|kuntosali)\D{0,40}?(?:joka\s*päivä|päivittäin)?\D{0,20}?(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
    ) ||
    text.match(
      /avoinna(?:\s+\w+){0,4}\s+joka\s*päivä\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
    );

  const wk = text.match(
    /\bma\s*[-–]\s*(?:pe|to|su)\.?\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
  );
  const we =
    text.match(
      /\b(?:la\s*[-–]\s*su|la|su|viikonloppu(?:isin|na)?)\.?\s*(?:klo\s*)?(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
    ) || null;
  const daily = text.match(
    /avoinna\s+(?:joka päivä\s+|päivittäin\s+)?(?:klo\s*)?(\d{1,3})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/i,
  );

  const pick = gymAccess || daily || wk;
  if (pick) {
    out.hoursWeekday = `${hhmm(pick[1], pick[2])}–${hhmm(pick[3], pick[4])}`;
    out.is247 = false;
  }
  if (we) {
    out.hoursWeekend = `${hhmm(we[1], we[2])}–${hhmm(we[3], we[4])}`;
    out.is247 = out.is247 ?? false;
  } else if (out.hoursWeekday && (gymAccess || daily)) {
    out.hoursWeekend = out.hoursWeekday;
  }
  return out;
}

export function adapterFor(chainId: string): ((html: string) => Extracted) | null {
  if (chainId === "c2") return extractElixia;
  if (chainId === "c1") return extractEasyFit;
  if (chainId === "c7") return extractForever;
  if (chainId === "c3") return extractFressi;
  if (chainId === "c9") return extractOleFit;
  if (chainId === "c8") return extractLadyLine;
  return null;
}

export function mergeExtracted(base: Extracted, more: Extracted): Extracted {
  return {
    priceFrom: base.priceFrom ?? more.priceFrom,
    priceLabel: base.priceFrom != null ? base.priceLabel : more.priceLabel,
    hoursWeekday: base.hoursWeekday ?? more.hoursWeekday,
    hoursWeekend: base.hoursWeekend ?? more.hoursWeekend,
    is247: base.is247 ?? more.is247,
    memberships:
      base.priceFrom != null ? base.memberships : more.memberships,
  };
}
