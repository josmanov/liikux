import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ChainPopupContextValue = {
  open: boolean;
  chainSlug: string | null;
  openChains: () => void;
  openChain: (slug: string) => void;
  close: () => void;
};

const ChainPopupContext = createContext<ChainPopupContextValue | null>(null);

export function ChainPopupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [chainSlug, setChainSlug] = useState<string | null>(null);

  const openChains = useCallback(() => {
    setChainSlug(null);
    setOpen(true);
  }, []);

  const openChain = useCallback((slug: string) => {
    setChainSlug(slug);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setChainSlug(null);
  }, []);

  const value = useMemo(
    () => ({ open, chainSlug, openChains, openChain, close }),
    [open, chainSlug, openChains, openChain, close],
  );

  return (
    <ChainPopupContext.Provider value={value}>
      {children}
    </ChainPopupContext.Provider>
  );
}

export function useChainPopup() {
  const ctx = useContext(ChainPopupContext);
  if (!ctx) {
    throw new Error("useChainPopup must be used within ChainPopupProvider");
  }
  return ctx;
}
