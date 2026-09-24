import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  useMyLocation: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

const DEFAULT_LABEL = "Helsinki";

const cityCenters: Record<string, LocationCoords> = {
  Helsinki: { lat: 60.1699, lng: 24.9384 },
  Espoo: { lat: 60.2055, lng: 24.6559 },
  Vantaa: { lat: 60.2934, lng: 25.0378 },
  Tampere: { lat: 61.4978, lng: 23.761 },
  Turku: { lat: 60.4518, lng: 22.2666 },
  Oulu: { lat: 65.0121, lng: 25.4651 },
};

function coordsForLabel(label: string): LocationCoords | null {
  const key = Object.keys(cityCenters).find(
    (city) => city.toLowerCase() === label.trim().toLowerCase(),
  );
  return key ? cityCenters[key] : null;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [label, setLabelState] = useState(DEFAULT_LABEL);
  const [lat, setLat] = useState<number | null>(cityCenters.Helsinki.lat);
  const [lng, setLng] = useState<number | null>(cityCenters.Helsinki.lng);

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
        if (!navigator.geolocation) {
          setLabelState("Lähellä minua");
          setLat(null);
          setLng(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLabelState("Lähellä minua");
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
          },
          () => {
            setLabelState("Lähellä minua");
            setLat(null);
            setLng(null);
          },
          { enableHighAccuracy: false, timeout: 8000 },
        );
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
