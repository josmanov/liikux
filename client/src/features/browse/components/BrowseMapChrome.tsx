import { Building2, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import LoadSpin from "../../../components/LoadSpin";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type AddressHit = { id: string; label: string; lat: number; lng: number };

type BrowseMapChromeProps = {
  t: TFn;
  cityLabel: string | null;
  addressDraft: string;
  locationLabel: string;
  addressSuggest: boolean;
  addressHits: AddressHit[];
  addressLoading: boolean;
  onAddressDraft: (value: string) => void;
  onAddressSuggest: (on: boolean) => void;
  onPickAddress: (hit: AddressHit) => void;
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  locateDisabled: boolean;
  onLocateFab: () => void;
};

export function BrowseMapChrome({
  t,
  cityLabel,
  addressDraft,
  locationLabel,
  addressSuggest,
  addressHits,
  addressLoading,
  onAddressDraft,
  onAddressSuggest,
  onPickAddress,
  onLocate,
  onZoomIn,
  onZoomOut,
  locateDisabled,
  onLocateFab,
}: BrowseMapChromeProps) {
  return (
    <>
      <div
        className="browse-map-side"
        onClick={(e) => e.stopPropagation()}
      >
        {cityLabel ? (
          <div className="browse-map-desk-city browse-glass">
            <Building2 size={14} strokeWidth={2.3} aria-hidden="true" />
            <span>{cityLabel}</span>
          </div>
        ) : null}
        <div className="browse-map-desk-tools">
          <div className="browse-map-address-wrap">
            <label className="browse-map-address browse-glass">
              <MapPin size={15} strokeWidth={2.3} />
              <input
                type="text"
                placeholder={t("addressPlaceholder")}
                aria-label={t("addressAria")}
                value={addressDraft}
                autoComplete="off"
                onChange={(e) => {
                  onAddressDraft(e.target.value);
                  onAddressSuggest(true);
                }}
                onFocus={() => {
                  if (
                    addressDraft.trim().length >= 3 &&
                    addressDraft.trim() !== locationLabel
                  ) {
                    onAddressSuggest(true);
                  }
                }}
                onBlur={() => {
                  onAddressSuggest(false);
                  onAddressDraft(locationLabel);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onAddressSuggest(false);
                }}
              />
              <button
                type="button"
                className="browse-map-locate"
                aria-label={t("useMyLocation")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onLocate}
              >
                <LocateFixed size={15} strokeWidth={2.4} />
              </button>
            </label>
            {addressSuggest && addressDraft.trim().length >= 3 &&
            addressDraft.trim() !== locationLabel ? (
              <ul className="browse-address-hits">
                {addressLoading && addressHits.length === 0 ? (
                  <li className="browse-address-hint">
                    <LoadSpin size="sm" />
                  </li>
                ) : null}
                {!addressLoading && addressHits.length === 0 ? (
                  <li className="browse-address-hint">{t("noResults")}</li>
                ) : null}
                {addressHits.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPickAddress(item)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
      <div className="browse-map-controls">
        <button
          type="button"
          className="browse-map-ctrl browse-glass"
          aria-label={t("mapZoomIn")}
          onClick={onZoomIn}
        >
          <Plus size={20} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          className="browse-map-ctrl browse-glass"
          aria-label={t("mapZoomOut")}
          onClick={onZoomOut}
        >
          <Minus size={20} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          className="browse-map-ctrl browse-map-locate-fab browse-glass"
          aria-label={t("mapGoToLocation")}
          disabled={locateDisabled}
          onClick={onLocateFab}
        >
          <LocateFixed size={19} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}
