import { useEffect, useState } from "react";

const API = "http://localhost:3001";

export type GeoHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function labelMatchesQuery(label: string, q: string) {
  const n = norm(q);
  if (n.length < 2) return false;
  const l = norm(label);
  if (l.startsWith(n)) return true;
  const street = l.split(",")[0] ?? "";
  const qStreet = n.replace(/\s+\d.*$/, "");
  if (!street.startsWith(qStreet)) return false;
  const num = n.match(/\d+/);
  if (!num) return true;
  return street.includes(num[0]) || l.includes(num[0]);
}

export function fetchGeocode(
  q: string,
  opts?: { lat?: number | null; lng?: number | null; signal?: AbortSignal },
): Promise<GeoHit[]> {
  const params = new URLSearchParams({ q });
  if (opts?.lat != null && opts?.lng != null) {
    params.set("lat", String(opts.lat));
    params.set("lng", String(opts.lng));
  }
  return fetch(`${API}/api/geocode?${params}`, { signal: opts?.signal })
    .then((r) => r.json())
    .then((data) => (Array.isArray(data) ? (data as GeoHit[]) : []));
}

export function fetchReverseLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  return fetch(`${API}/api/geocode/reverse?${params}`)
    .then((r) => r.json())
    .then((data) => {
      if (data && typeof data.label === "string" && data.label.trim()) {
        return data.label.trim();
      }
      return null;
    })
    .catch(() => null);
}

const suggestCache = new Map<string, GeoHit[]>();

function suggestKey(q: string, lat: number | null, lng: number | null) {
  const bias =
    lat != null && lng != null ? `${lat.toFixed(2)},${lng.toFixed(2)}` : "";
  return `${q.toLowerCase()}|${bias}`;
}

export function useAddressSuggest(
  draft: string,
  enabled: boolean,
  origin?: { lat?: number | null; lng?: number | null },
) {
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [loading, setLoading] = useState(false);
  const q = draft.trim();
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;

  useEffect(() => {
    if (!enabled || q.length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }

    const key = suggestKey(q, lat, lng);
    const cached = suggestCache.get(key);
    if (cached) {
      setHits(cached);
      setLoading(false);
      return;
    }

    setHits((prev) => prev.filter((h) => labelMatchesQuery(h.label, q)));
    setLoading(true);
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      fetchGeocode(q, { lat, lng, signal: ac.signal })
        .then((data) => {
          if (ac.signal.aborted) return;
          suggestCache.set(key, data);
          setHits(data);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setHits([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q, enabled, lat, lng]);

  return { hits, loading };
}
