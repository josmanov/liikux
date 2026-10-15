import { X } from "lucide-react";
import UxSwitch from "../../../components/UxSwitch";
import type { Chain } from "../../../data/types";
import type { MessageKey } from "../../../i18n/messages";
import { filterChainVisual } from "../utils/chainFilters";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type ChainOption = { id: string; label: string };

type BrowseChainsMenuProps = {
  t: TFn;
  chains: Chain[];
  options: ChainOption[];
  selectedChains: string[];
  visibleChainFilterIds: string[];
  chainQuery: string;
  onChainQuery: (value: string) => void;
  onToggleChain: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
};

export function BrowseChainsMenu({
  t,
  chains,
  options,
  selectedChains,
  visibleChainFilterIds,
  chainQuery,
  onChainQuery,
  onToggleChain,
  onSelectAll,
  onClearAll,
  onClose,
}: BrowseChainsMenuProps) {
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
            <button
              type="button"
              className="chain-popup-close"
              onClick={onClose}
              aria-label={t("close")}
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
          <div className="browse-chains-top">
            <div className="group">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
                <g>
                  <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
                </g>
              </svg>
              <input
                className="input"
                type="search"
                placeholder={t("chainSearch")}
                value={chainQuery}
                onChange={(e) => onChainQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="browse-chains-action"
              onClick={onSelectAll}
            >
              {t("all")}
            </button>
            <button
              type="button"
              className="browse-chains-clear"
              onClick={onClearAll}
            >
              {t("clear")}
            </button>
          </div>
          <p className="browse-chains-picked">
            {t("chainsPicked", {
              n: selectedChains.length,
              total: visibleChainFilterIds.length,
            })}
          </p>
        </div>
        <div className="chain-popup-scroll">
          <ul
            className="chain-popup-list list-pop"
            onScroll={(e) => {
              e.currentTarget.parentElement?.classList.toggle(
                "is-scrolled",
                e.currentTarget.scrollTop > 6,
              );
            }}
          >
            {options
              .filter((opt) => {
                const q = chainQuery.trim().toLowerCase();
                if (!q) return true;
                return opt.label.toLowerCase().includes(q);
              })
              .map((opt, i) => {
                const on = selectedChains.includes(opt.id);
                const visual = filterChainVisual(opt.id, chains);
                return (
                  <li
                    key={opt.id}
                    style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  >
                    <label className="browse-chains-row">
                      <span
                        className={[
                          "chain-popup-media",
                          visual.logo ? "is-logo" : "",
                          visual.logoClass,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <img src={visual.image} alt="" />
                      </span>
                      <span className="browse-chains-main">
                        <span className="browse-chains-copy">
                          <span className="browse-chains-name">
                            {opt.label}
                          </span>
                          <span className="browse-chains-hint">
                            {t("chainFilterHint")}
                          </span>
                        </span>
                        <UxSwitch
                          size="sm"
                          checked={on}
                          onChange={() => onToggleChain(opt.id)}
                        />
                      </span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </div>
  );
}
