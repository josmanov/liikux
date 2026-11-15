import type { GeocodeHit } from "./photon.js";

/**
 * Digitransit geocoding (run by HSL / Fintraffic).
 * Built on Finnish official address data, so Finnish street addresses are
 * found reliably. Free, but needs an API key: register at
 * https://portal-api.digitransit.fi and set DIGITRANSIT_API_KEY on the server.
 *
 * Docs: https://digitransit.fi/en/developers/apis/3-geocoding-api/
 */
const BASE = "https://api.digitransit.fi/geocoding/v1";

type Feature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    gid?: string;
    layer?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    localadmin?: string;
    label?: string;
  };
};

export function digitransitEnabled() {
  return Boolean(process.env.DIGITRANSIT_API_KEY?.trim());
}

function toKind(layer: string) {
  if (layer === "address") return "house";
  if (layer === "street") return "street";
  if (layer === "locality" || layer === "localadmin") return "city";
  if (layer === "neighbourhood") return "district";
  return layer;
}

function toLabel(p: NonNullable<Feature["properties"]>) {
  const city = p.locality || p.localadmin || "";
  if (p.street && p.housenumber) return `${p.street} ${p.housenumber}, ${city}`;
  if (p.layer === "locality" || p.layer === "localadmin") return city || p.name || "";
  if (p.name && city && p.name !== city) return `${p.name}, ${city}`;
  return p.name || p.label || "";
}

async function call(path: string, params: Record<string, string>) {
  const url = `${BASE}/${path}?` + new URLSearchParams(params);
  const res = await fetch(url, {
    headers: {
      "digitransit-subscription-key": process.env.DIGITRANSIT_API_KEY!.trim(),
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`digitransit ${res.status}`);
  const data = (await res.json()) as { features?: Feature[] };
  return data.features ?? [];
}

export async function digitransitSearch(
  q: string,
  bias?: { lat: number; lng: number },
): Promise<GeocodeHit[]> {
  const params: Record<string, string> = {
    text: q,
    lang: "fi",
    size: "10",
    layers: "address,street,locality,localadmin,neighbourhood",
  };
  if (bias) {
    params["focus.point.lat"] = String(bias.lat);
    params["focus.point.lon"] = String(bias.lng);
  }
  const features = await call("autocomplete", params);
  const hits: GeocodeHit[] = [];
  for (const f of features) {
    const c = f.geometry?.coordinates;
    const p = f.properties ?? {};
    if (!c || c.length < 2) continue;
    const label = toLabel(p).trim();
    if (!label) continue;
    hits.push({
      id: `dt-${p.gid ?? label}`,
      label,
      lat: c[1]!,
      lng: c[0]!,
      kind: toKind(p.layer ?? ""),
    });
  }
  return hits;
}
