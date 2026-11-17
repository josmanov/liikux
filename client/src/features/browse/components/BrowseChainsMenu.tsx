import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseChainsMenuProps = {
  t: TFn;
  /** The chain tiles (BrowseChainPicker). */
  children: ReactNode;
  onClose: () => void;
};

/** Phones: the chain tiles in a sheet (desktop shows them in the filter bar dropdown). */
export function BrowseChainsMenu({ t, children, onClose }: BrowseChainsMenuProps) {
  return (
    <div className="chain-popup-overlay" onClick={onClose}>
      <div
        className="chain-popup-card browse-chains-card"
        role="dialog"
        aria-modal="true"
        aria-label={t("chains")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chain-popup-banner">
          <div className="chain-popup-banner-row">
            <h2 className="chain-popup-title">{t("chains")}</h2>
            <button type="button" className="chain-popup-close" onClick={onClose} aria-label={t("close")}>
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <div className="chain-popup-scroll browse-chains-sheet">{children}</div>
      </div>
    </div>
  );
}
