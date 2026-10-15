import { Euro } from "lucide-react";
import { PRICE_MAX, PRICE_MIN } from "../../../data/browseSearch";
import type { MessageKey } from "../../../i18n/messages";
import { BrowseDualRange } from "./BrowseDualRange";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowsePriceRangeProps = {
  priceMin: number;
  priceMax: number;
  onPriceMin: (n: number) => void;
  onPriceMax: (n: number) => void;
  t: TFn;
};

export function BrowsePriceRange({
  priceMin,
  priceMax,
  onPriceMin,
  onPriceMax,
  t,
}: BrowsePriceRangeProps) {
  return (
    <>
      <div className="browse-distance-head">
        <span className="browse-slider-title">
          <Euro size={16} strokeWidth={2.2} />
          {t("price")}
        </span>
        <strong>
          {priceMin} – {priceMax} €
        </strong>
      </div>
      <BrowseDualRange
        lo={priceMin}
        hi={priceMax}
        onLo={onPriceMin}
        onHi={onPriceMax}
        minLabel={t("priceMinAria")}
        maxLabel={t("priceMaxAria")}
      />
      <div className="browse-dual-ends">
        <span>{PRICE_MIN} €</span>
        <span>{PRICE_MAX} €</span>
      </div>
    </>
  );
}
