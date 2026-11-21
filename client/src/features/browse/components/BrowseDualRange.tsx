import {
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
} from "../../../data/browseSearch";
import { BrowseSlider } from "./BrowseSlider";

export function BrowseDualRange({
  lo,
  hi,
  onLo,
  onHi,
  minLabel,
  maxLabel,
}: {
  lo: number;
  hi: number;
  onLo: (n: number) => void;
  onHi: (n: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <BrowseSlider
      min={PRICE_MIN}
      max={PRICE_MAX}
      step={PRICE_STEP}
      values={[lo, hi]}
      labels={[minLabel, maxLabel]}
      onChange={(i, v) => (i === 0 ? onLo(v) : onHi(v))}
    />
  );
}
