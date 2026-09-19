import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocationContextValue = {
  label: string;
  setLabel: (label: string) => void;
  useMyLocation: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

const DEFAULT_LABEL = "Helsinki";

export function LocationProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState(DEFAULT_LABEL);

  const value = useMemo(
    () => ({
      label,
      setLabel: (next: string) => {
        const trimmed = next.trim();
        setLabel(trimmed || DEFAULT_LABEL);
      },
      useMyLocation: () => {
        if (!navigator.geolocation) {
          setLabel("Lähellä minua");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          () => setLabel("Lähellä minua"),
          () => setLabel("Lähellä minua"),
          { enableHighAccuracy: false, timeout: 8000 },
        );
      },
    }),
    [label],
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
