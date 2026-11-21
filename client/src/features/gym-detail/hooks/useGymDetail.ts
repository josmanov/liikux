import { useEffect, useState } from "react";
import { API, previewHeaders } from "../../../data/apiBase";
import { fetchChainGyms, fetchGyms } from "../../../data/api";
import type { Chain, Gym } from "../../../data/types";
import { distanceKm } from "../../browse/utils/distanceKm";

export type GymDetail = Gym & { chain: Chain | null };
export type GymWithDistance = Gym & { km: number };

/** Chains that are not real chains ("other gyms"), so they have no "more from this chain". */
const NOT_A_CHAIN = ["muut", "yksityiset"];

function nearestTo(gym: Gym, list: Gym[], max: number): GymWithDistance[] {
  return list
    .filter((g) => g.slug !== gym.slug && g.lat != null && g.lng != null)
    .map((g) => ({ ...g, km: distanceKm(gym.lat, gym.lng, g.lat, g.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, max);
}

/**
 * Everything the gym page needs, loaded from the API:
 *  - gym:       the gym itself (with its chain)
 *  - nearby:    the 4 closest other gyms (any chain), for "compare with nearby"
 *  - chainGyms: the 6 closest gyms of the same chain
 */
export function useGymDetail(slug: string | undefined) {
  const [gym, setGym] = useState<GymDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [nearby, setNearby] = useState<GymWithDistance[]>([]);
  const [chainGyms, setChainGyms] = useState<GymWithDistance[]>([]);

  // 1. The gym
  useEffect(() => {
    if (!slug) {
      setGym(null);
      setStatus("missing");
      return;
    }
    let alive = true;
    setStatus("loading");
    fetch(`${API}/api/gyms/${encodeURIComponent(slug)}`, { headers: previewHeaders() })
      .then((r) => (r.ok ? (r.json() as Promise<GymDetail>) : null))
      .catch(() => null)
      .then((data) => {
        if (!alive) return;
        setGym(data);
        setStatus(data ? "ok" : "missing");
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  // 2. Nearby gyms + other gyms of the same chain
  useEffect(() => {
    setNearby([]);
    setChainGyms([]);
    if (!gym || gym.lat == null || gym.lng == null) return;
    let alive = true;

    fetchGyms().then((all) => alive && setNearby(nearestTo(gym, all, 4)));

    const chainSlug = gym.chain?.slug?.trim();
    if (chainSlug && !NOT_A_CHAIN.includes(chainSlug)) {
      fetchChainGyms(chainSlug).then(
        (res) => alive && setChainGyms(nearestTo(gym, res?.gyms ?? [], 6)),
      );
    }
    return () => {
      alive = false;
    };
  }, [gym]);

  return { gym, status, nearby, chainGyms };
}
