export type GeocodeHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  kind?: string;
};

type NominatimRow = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

export function parseStreetQuery(q: string) {
  const m = q.match(/^(.+?)\s+(\d+\s*[a-zA-ZäöåÄÖÅ]?)\s*$/);
  if (!m) return { street: q, number: "" };
  return { street: m[1]!.trim(), number: m[2]!.trim() };
}

const ADDRESS_TYPES = new Set(["house", "street", "locality", "district", "city"]);

function labelFromPhotonProps(
  p: Record<string, string | number | undefined>,
  fallback: string,
) {
  const road = String(p.street || p.name || "");
  const num = String(p.housenumber || "");
  const city = String(p.city || p.town || p.village || "");
  if (road && num && city) return `${road} ${num}, ${city}`;
  if (road && city) return `${road}, ${city}`;
  if (city) return city;
  return String(p.name || p.street || fallback);
}

export function hitFitsQuery(
  hit: GeocodeHit,
  q: string,
  street: string,
  number: string,
) {
  const l = hit.label.toLowerCase();
  const ql = q.toLowerCase();
  if (l.startsWith(ql)) return true;
  const head = l.split(",")[0] ?? "";
  const sl = street.toLowerCase();
  if (!head.startsWith(sl) && !l.startsWith(sl)) return false;
  if (!number) return true;
  const n = number.toLowerCase();
  return head.includes(n) || l.includes(n);
}

export function looksLikeCityQuery(q: string) {
  const t = q.trim();
  if (t.length < 2) return false;
  if (/\d/.test(t)) return false;
  if (t.includes(",")) return false;
  return true;
}

export async function photonSearch(
  q: string,
  bias?: { lat: number; lng: number },
) {
  // Note: we used to restrict queries without a number to cities only
  // ("layer=city"). That made street names like "Hämeentie" return nothing
  // useful while typing, so now we search everything and let rankHits()
  // put cities first for city-like queries.
  const params = new URLSearchParams({
    q,
    lang: "default",
    limit: "15",
    bbox: "19.5,59.5,31.6,70.1",
  });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
    // Lower scale = location matters more than how "famous" a place is.
    params.set("location_bias_scale", "0.1");
    params.set("zoom", "11");
  }

  const url = "https://photon.komoot.io/api/?" + params;
  const upstream = await fetch(url, {
    headers: { "Accept-Language": "fi" },
  });
  if (!upstream.ok) return [] as GeocodeHit[];

  const data = (await upstream.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] };
      properties?: Record<string, string | number | undefined>;
    }>;
  };

  if (!Array.isArray(data.features)) return [] as GeocodeHit[];

  const hits: GeocodeHit[] = [];
  for (const f of data.features) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const country = String(p.countrycode || "").toUpperCase();
    if (country && country !== "FI") continue;
    const kind = String(p.type || "").toLowerCase();
    if (kind && !ADDRESS_TYPES.has(kind)) continue;

    const label = labelFromPhotonProps(p, q);
    if (!label.trim()) continue;

    hits.push({
      id: `ph-${p.osm_id ?? label}-${coords[0]}-${coords[1]}`,
      label,
      lat: coords[1]!,
      lng: coords[0]!,
      kind,
    });
  }
  return hits;
}

export function dedupeHits(hits: GeocodeHit[]) {
  const seen = new Set<string>();
  const out: GeocodeHit[] = [];
  for (const h of hits) {
    const key = h.label.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/** Rough distance in km, good enough for sorting. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * How well a label matches the house number the user typed:
 * 0 = exact ("Hämeentie 5"), 1 = same number with a letter ("5a"), 2 = no match.
 */
function numberScore(label: string, number: string) {
  if (!number) return 0;
  const head = (label.split(",")[0] ?? "").toLowerCase();
  const n = number.toLowerCase().replace(/\s+/g, "");
  const m = head.match(/(\d+\s*[a-zäöå]?)\s*$/);
  const got = (m?.[1] ?? "").replace(/\s+/g, "");
  if (got === n) return 0;
  if (got.startsWith(n) || n.startsWith(got)) return got ? 1 : 2;
  return 2;
}

/**
 * Sort order: exact label → exact house number → (cities first for city-like
 * queries) → closest to where the user is → label starts with the query → shorter.
 */
export function rankHits(
  hits: GeocodeHit[],
  q: string,
  number: string,
  bias?: { lat: number; lng: number },
) {
  const ql = q.toLowerCase();
  const cityLike = looksLikeCityQuery(q);
  return hits
    .map((h, i) => ({ h, i, d: bias ? km(h, bias) : 0 }))
    .sort((a, b) => {
      const aLabel = a.h.label.toLowerCase();
      const bLabel = b.h.label.toLowerCase();
      const aExact = aLabel === ql ? 0 : 1;
      const bExact = bLabel === ql ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aNum = numberScore(a.h.label, number);
      const bNum = numberScore(b.h.label, number);
      // A wrong house number always loses.
      if ((aNum === 2) !== (bNum === 2)) return aNum - bNum;
      // Same street in several towns: the one near the user wins,
      // even if it is "5a" and the far one is exactly "5".
      if (bias && !cityLike && Math.abs(a.d - b.d) > 5) return a.d - b.d;
      if (aNum !== bNum) return aNum - bNum;
      if (cityLike) {
        const aCity =
          a.h.kind === "city" || a.h.kind === "locality" || !aLabel.includes(",")
            ? 0
            : 1;
        const bCity =
          b.h.kind === "city" || b.h.kind === "locality" || !bLabel.includes(",")
            ? 0
            : 1;
        if (aCity !== bCity) return aCity - bCity;
      }
      const aStart = aLabel.startsWith(ql) ? 0 : 1;
      const bStart = bLabel.startsWith(ql) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      if (aLabel.length !== bLabel.length) return aLabel.length - bLabel.length;
      return a.i - b.i;
    })
    .map((x) => x.h);
}

function shortStreetLabel(road: string, num: string, city: string) {
  if (road && num && city) return `${road} ${num}, ${city}`;
  if (road && city) return `${road}, ${city}`;
  if (road && num) return `${road} ${num}`;
  return "";
}

async function nominatimReverse(lat: number, lng: number) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
    });
  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Liikux/1.0 (+https://liikux.fi)",
      "Accept-Language": "fi",
    },
  });
  if (!upstream.ok) return null;
  const row = (await upstream.json()) as NominatimRow;
  const a = row.address ?? {};
  const road = a.road || a.pedestrian || a.street || "";
  const num = a.house_number || "";
  const city = a.city || a.town || a.municipality || a.village || "";
  const label = shortStreetLabel(road, num, city);
  if (!label) return null;
  return { label };
}

async function photonReverse(lat: number, lng: number) {
  const url =
    "https://photon.komoot.io/reverse?" +
    new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      lang: "default",
    });
  const upstream = await fetch(url, {
    headers: { "Accept-Language": "fi" },
  });
  if (!upstream.ok) return null;
  const data = (await upstream.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] };
      properties?: Record<string, string | number | undefined>;
    }>;
  };
  const f = data.features?.[0];
  if (!f) return null;
  const p = f.properties ?? {};
  const road = String(p.street || "");
  const num = String(p.housenumber || "");
  const city = String(p.city || p.town || p.village || "");
  const label =
    shortStreetLabel(road, num, city) || labelFromPhotonProps(p, "");
  if (!label.trim() || label.trim().toLowerCase() === city.toLowerCase()) {
    return null;
  }
  return { label };
}

export async function reverseAddress(lat: number, lng: number) {
  const fromPh = await photonReverse(lat, lng).catch(() => null);
  if (fromPh && /\d/.test(fromPh.label)) return fromPh;
  const fromNom = await nominatimReverse(lat, lng).catch(() => null);
  if (fromNom && /\d/.test(fromNom.label)) return fromNom;
  return fromPh || fromNom;
}
