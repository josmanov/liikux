import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchReverseLabel } from "../data/geocode";
import { cityCenterForName } from "../data/citySlug";

type LocationCoords = {
  lat: number;
  lng: number;
};

type LocationContextValue = {
  label: string;
  lat: number | null;
  lng: number | null;
  setLabel: (label: string) => void;
  setLocation: (next: {
    label: string;
    lat?: number | null;
    lng?: number | null;
  }) => void;
  useMyLocation: () => Promise<{
    label: string;
    lat: number;
    lng: number;
  } | null>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

const STORAGE_KEY = "liikux-location";
const DEFAULT_LABEL = "Helsinki";

function coordsForLabel(label: string): LocationCoords | null {
  const hit = cityCenterForName(label);
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

function readStoredLocation(): {
  label: string;
  lat: number | null;
  lng: number | null;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const hel = cityCenterForName("Helsinki")!;
      return {
        label: DEFAULT_LABEL,
        lat: hel.lat,
        lng: hel.lng,
      };
    }
    const parsed = JSON.parse(raw) as {
      label?: unknown;
      lat?: unknown;
      lng?: unknown;
    };
    const label =
      typeof parsed.label === "string" && parsed.label.trim()
        ? parsed.label.trim()
        : DEFAULT_LABEL;
    const lat = typeof parsed.lat === "number" ? parsed.lat : null;
    const lng = typeof parsed.lng === "number" ? parsed.lng : null;
    if (lat != null && lng != null) {
      return { label, lat, lng };
    }
    const fromCity = coordsForLabel(label);
    const hel = cityCenterForName("Helsinki")!;
    return {
      label,
      lat: fromCity?.lat ?? hel.lat,
      lng: fromCity?.lng ?? hel.lng,
    };
  } catch {
    const hel = cityCenterForName("Helsinki")!;
    return {
      label: DEFAULT_LABEL,
      lat: hel.lat,
      lng: hel.lng,
    };
  }
}

function writeStoredLocation(next: {
  label: string;
  lat: number | null;
  lng: number | null;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const start = readStoredLocation();
  const [label, setLabelState] = useState(start.label);
  const [lat, setLat] = useState<number | null>(start.lat);
  const [lng, setLng] = useState<number | null>(start.lng);

  useEffect(() => {
    writeStoredLocation({ label, lat, lng });
  }, [label, lat, lng]);

  const value = useMemo(
    () => ({
      label,
      lat,
      lng,
      setLocation: (next: {
        label: string;
        lat?: number | null;
        lng?: number | null;
      }) => {
        const trimmed = next.label.trim() || DEFAULT_LABEL;
        setLabelState(trimmed);
        if (next.lat != null && next.lng != null) {
          setLat(next.lat);
          setLng(next.lng);
          return;
        }
        if (next.lat === null || next.lng === null) {
          setLat(null);
          setLng(null);
          return;
        }
        const fromCity = coordsForLabel(trimmed);
        setLat(fromCity?.lat ?? null);
        setLng(fromCity?.lng ?? null);
      },
      setLabel: (next: string) => {
        const trimmed = next.trim() || DEFAULT_LABEL;
        setLabelState(trimmed);
        const fromCity = coordsForLabel(trimmed);
        setLat(fromCity?.lat ?? null);
        setLng(fromCity?.lng ?? null);
      },
      useMyLocation: () => {
        if (!navigator.geolocation) return Promise.resolve(null);
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const nextLat = pos.coords.latitude;
              const nextLng = pos.coords.longitude;
              setLat(nextLat);
              setLng(nextLng);
              fetchReverseLabel(nextLat, nextLng).then((place) => {
                const nextLabel = (place || "").trim() || DEFAULT_LABEL;
                if (place) setLabelState(nextLabel);
                resolve({
                  label: nextLabel,
                  lat: nextLat,
                  lng: nextLng,
                });
              });
            },
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 8000 },
          );
        });
      },
    }),
    [label, lat, lng],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useAppLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useAppLocation needs LocationProvider");
  }
  return ctx;
}
