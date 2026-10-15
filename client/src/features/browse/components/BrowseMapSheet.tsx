import { LocateFixed, MapPin, X } from "lucide-react";
import LoadSpin from "../../../components/LoadSpin";
import type { CityCenter } from "../../../data/citySlug";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type AddressHit = { id: string; label: string; lat: number; lng: number };

type BrowseMapSheetProps = {
  t: TFn;
  mode: "address" | "region";
  onClose: () => void;
  addressDraft: string;
  onAddressChange: (value: string) => void;
  addressHits: AddressHit[];
  addressLoading: boolean;
  locationLabel: string;
  onPickAddress: (hit: AddressHit) => void;
  onLocate: () => void;
  cityQuery: string;
  onCityQuery: (value: string) => void;
  cityOptions: CityCenter[];
  activeCitySlug: string | null;
  onFocusCity: (city: CityCenter) => void;
};

export function BrowseMapSheet({
  t,
  mode,
  onClose,
  addressDraft,
  onAddressChange,
  addressHits,
  addressLoading,
  locationLabel,
  onPickAddress,
  onLocate,
  cityQuery,
  onCityQuery,
  cityOptions,
  activeCitySlug,
  onFocusCity,
}: BrowseMapSheetProps) {
  return (
    <div
      className="browse-map-sheet-root"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="browse-map-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "address" ? t("fromAddressAria") : t("regions")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="browse-map-sheet-head">
          <h2 className="browse-map-sheet-title">
            {mode === "address" ? t("fromAddressAria") : t("regions")}
          </h2>
          <button
            type="button"
            className="chain-popup-close"
            aria-label={t("close")}
            onClick={onClose}
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {mode === "address" ? (
          <div className="browse-map-sheet-body">
            <label className="browse-map-sheet-field">
              <MapPin size={16} strokeWidth={2.3} />
              <input
                type="search"
                autoFocus
                placeholder={t("addressPlaceholder")}
                aria-label={t("addressAria")}
                value={addressDraft}
                autoComplete="off"
                onChange={(e) => onAddressChange(e.target.value)}
              />
              <button
                type="button"
                className="browse-map-locate"
                aria-label={t("useMyLocation")}
                onClick={onLocate}
              >
                <LocateFixed size={16} strokeWidth={2.4} />
              </button>
            </label>
            <ul className="browse-map-sheet-hits">
              {addressDraft.trim().length >= 3 &&
              addressDraft.trim() !== locationLabel ? (
                <>
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
                        onClick={() => onPickAddress(item)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </>
              ) : (
                <li className="browse-address-hint">{locationLabel}</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="browse-map-sheet-body">
            <label className="browse-map-sheet-field">
              <input
                type="search"
                autoFocus
                placeholder={t("searchCity")}
                aria-label={t("searchCity")}
                value={cityQuery}
                onChange={(e) => onCityQuery(e.target.value)}
              />
            </label>
            <ul className="browse-map-sheet-hits is-regions">
              {cityOptions.map((city) => (
                <li key={city.slug}>
                  <button
                    type="button"
                    className={city.slug === activeCitySlug ? "is-on" : ""}
                    onClick={() => onFocusCity(city)}
                  >
                    {city.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
