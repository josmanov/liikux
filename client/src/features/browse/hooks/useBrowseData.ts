import { useEffect, useState, type MutableRefObject } from "react";
import { fetchGymsAndChains } from "../../../data/api";
import type { Chain, Gym } from "../../../data/types";
import { pointInPolygon, type MaakuntaGeom } from "../utils/maakuntaGeom";

export type MaakuntaFeature = {
  nimi: string;
  maakunta: string;
  geometry: MaakuntaGeom;
};

export function useBrowseData({
  maakunnatReady,
  maakuntaFeaturesRef,
}: {
  maakunnatReady: boolean;
  maakuntaFeaturesRef: MutableRefObject<MaakuntaFeature[]>;
}) {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [gymMaakuntaMap, setGymMaakuntaMap] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    fetchGymsAndChains()
      .then(([gymData, chainData]) => {
        if (cancelled) return;
        setGyms(gymData);
        setChains(chainData);
      })
      .catch(() => {
        if (cancelled) return;
        setGyms([]);
        setChains([]);
      })
      .finally(() => {
        if (!cancelled) setDataReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!maakunnatReady || maakuntaFeaturesRef.current.length === 0) return;
    if (gyms.length === 0) {
      setGymMaakuntaMap({});
      return;
    }
    const next: Record<string, string> = {};
    for (const g of gyms) {
      if (g.lat == null || g.lng == null) continue;
      for (const f of maakuntaFeaturesRef.current) {
        if (pointInPolygon(g.lng, g.lat, f.geometry)) {
          next[g.id] = f.nimi;
          break;
        }
      }
    }
    setGymMaakuntaMap(next);
  }, [gyms, maakunnatReady, maakuntaFeaturesRef]);

  return { gyms, chains, dataReady, gymMaakuntaMap };
}
