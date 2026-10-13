import {
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
} from "../../../data/browseSearch";

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
  const span = PRICE_MAX - PRICE_MIN || 1;
  const left = ((lo - PRICE_MIN) / span) * 100;
  const right = ((hi - PRICE_MIN) / span) * 100;
  return (
    <div className="browse-dual">
      <div className="browse-dual-rail">
        <div
          className="browse-dual-fill"
          style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
        />
      </div>
      <input
        type="range"
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={lo}
        aria-label={minLabel}
        className="browse-dual-input is-lo"
        onChange={(e) => onLo(Math.min(Number(e.target.value), hi))}
      />
      <input
        type="range"
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={hi}
        aria-label={maxLabel}
        className="browse-dual-input is-hi"
        onChange={(e) => onHi(Math.max(Number(e.target.value), lo))}
      />
    </div>
  );
}
