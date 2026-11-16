import { formatGymStreetLine, formatPricePill } from "../data/format";
import type { Chain, Gym } from "../data/types";
import type { Lang } from "../i18n/lang";

/**
 * Builds the HTML of the map pins. Every map on the site (browse, gym page,
 * favorites) uses these, so a gym looks the same everywhere.
 * The look is in map/pins.css.
 */

const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2C5 8 6.8 6.2 9.1 6.2c1.3 0 2.3.6 2.9 1.6.6-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.6C19 15.6 12 20 12 20z"/></svg>';

/** The parts of a chain a pin needs (its logo). */
type PinChain = Pick<Chain, "image" | "logoFit" | "logoClass">;

type PinOptions = {
  lang: Lang;
  /** Size for the current zoom level (see markerScaleForZoom). 1 = full size. */
  scale?: number;
  favorite?: boolean;
  selected?: boolean;
  hovered?: boolean;
};

/**
 * One gym: a square tile with the chain logo (or a dumbbell for independent
 * gyms), the price label above it, and the street address (shown when selected).
 *
 * Returns the whole pin (`el`, give this to the MapLibre Marker) and the
 * clickable tile inside it (`hit`, add click/hover listeners to this).
 */
export function buildGymPin(gym: Gym, chain: PinChain | null | undefined, options: PinOptions) {
  const logo = chain?.image && !chain.image.includes("/pins/") ? chain.image : null;

  const el = document.createElement("div");
  el.className = logo ? "gym-pin is-brand-pin" : "gym-pin is-plain-pin";
  el.dataset.gymId = gym.id;
  el.dataset.gymSlug = gym.slug;
  if (options.favorite) el.classList.add("is-fav");
  el.style.setProperty("--pin-scale", String(options.scale ?? 1));

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = [
    "gym-pin-hit",
    logo ? "is-brand" : "",
    logo && chain?.logoFit === "contain" ? "is-logo" : "",
    logo && chain?.logoClass ? chain.logoClass : "",
    options.selected ? "is-selected" : "",
    options.hovered ? "is-hovered" : "",
  ]
    .filter(Boolean)
    .join(" ");
  hit.setAttribute("aria-label", gym.name);

  const media = document.createElement("span");
  media.className = "gym-pin-media";
  const img = document.createElement("img");
  img.src = logo || "/pins/gym-pin.png";
  img.alt = "";
  img.decoding = "async";
  media.appendChild(img);
  hit.appendChild(media);

  const heart = document.createElement("span");
  heart.className = "gym-pin-fav";
  heart.innerHTML = HEART_SVG;
  hit.appendChild(heart);
  el.appendChild(hit);

  const street = formatGymStreetLine(gym);
  if (street) {
    const address = document.createElement("span");
    address.className = "gym-pin-address";
    address.textContent = street;
    el.appendChild(address);
  }

  const price = formatPricePill(gym.priceFrom, options.lang);
  if (price) {
    const label = document.createElement("span");
    label.className = "gym-pin-price";
    label.textContent = price;
    el.appendChild(label);
  }

  return { el, hit };
}

/** "You are here": the pulsing blue dot with the address in a blue label. */
export function buildOriginPin(label: string, ariaLabel: string) {
  const el = document.createElement("div");
  el.className = "gym-origin-pin";
  el.style.zIndex = "15000";
  el.setAttribute("aria-label", ariaLabel);
  if (label.trim()) {
    const text = document.createElement("span");
    text.className = "gym-origin-pin-label";
    text.textContent = label;
    el.appendChild(text);
  }
  for (const className of ["gym-origin-pin-ring", "gym-origin-pin-ring is-late", "gym-origin-pin-core"]) {
    const part = document.createElement("span");
    part.className = className;
    el.appendChild(part);
  }
  return el;
}
