import { Check } from "lucide-react";
import type { Chain } from "../../../data/types";
import type { MessageKey } from "../../../i18n/messages";
import { OTHER_CHAIN_FILTER_ID, filterChainVisual } from "../utils/chainFilters";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type ChainOption = { id: string; label: string };

type BrowseChainPickerProps = {
  t: TFn;
  chains: Chain[];
  options: ChainOption[];
  selected: string[];
  /** false = no chain filter (every chain is shown). */
  active: boolean;
  onPick: (id: string) => void;
  onAll: () => void;
};

/**
 * Chain filter as a grid of logo tiles.
 *   - Nothing picked = every chain is shown ("Kaikki ketjut" is on).
 *   - Click a tile = show only that chain; click more tiles to add them.
 *   - Click a picked tile again to drop it; dropping the last one shows all again.
 */
export function BrowseChainPicker({ t, chains, options, selected, active, onPick, onAll }: BrowseChainPickerProps) {
  return (
    <div className="chain-picker">
      <button
        type="button"
        className={["chain-picker-all", !active ? "is-on" : ""].filter(Boolean).join(" ")}
        aria-pressed={!active}
        onClick={onAll}
      >
        {t("allChains")}
      </button>
      <ul className="chain-picker-grid">
        {options.map((opt) => {
          const on = active && selected.includes(opt.id);
          const visual = filterChainVisual(opt.id, chains);
          return (
            <li key={opt.id}>
              <button
                type="button"
                className={["chain-picker-tile", on ? "is-on" : ""].filter(Boolean).join(" ")}
                aria-pressed={on}
                onClick={() => onPick(opt.id)}
              >
                {/* Same logo tile as the result rows (browse-row-media + the chain's own logo class). */}
                <span
                  className={[
                    "browse-row-media",
                    "chain-picker-logo",
                    opt.id === OTHER_CHAIN_FILTER_ID ? "is-pin" : visual.logo ? "is-logo" : "",
                    opt.id === OTHER_CHAIN_FILTER_ID ? "" : visual.logoClass,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <img src={visual.image} alt="" />
                </span>
                <span className="chain-picker-name">{opt.label}</span>
                {on ? <Check className="chain-picker-check" size={15} strokeWidth={2.8} aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
