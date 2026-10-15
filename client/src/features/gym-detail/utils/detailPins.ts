export function makeGymPin(opts: { addressText?: string | null }) {
  const el = document.createElement("div");
  el.className = "gym-detail-pin";

  if (opts.addressText) {
    const addr = document.createElement("span");
    addr.className = "gym-detail-pin-address";
    addr.textContent = opts.addressText;
    el.appendChild(addr);
  }

  const hit = document.createElement("div");
  hit.className = "gym-detail-pin-hit is-selected";
  const img = document.createElement("img");
  img.src = "/pins/gym-pin.png";
  img.alt = "";
  hit.appendChild(img);
  el.appendChild(hit);
  return el;
}

export function makeOriginPin(ariaLabel: string, addressLabel?: string | null) {
  const el = document.createElement("div");
  el.className = "gym-detail-origin-pin";
  el.setAttribute("aria-label", ariaLabel);
  if (addressLabel?.trim()) {
    const label = document.createElement("span");
    label.className = "gym-detail-origin-label";
    label.textContent = addressLabel.trim();
    el.appendChild(label);
  }
  const ring = document.createElement("span");
  ring.className = "gym-origin-pin-ring";
  const ringLate = document.createElement("span");
  ringLate.className = "gym-origin-pin-ring is-late";
  const core = document.createElement("span");
  core.className = "gym-origin-pin-core";
  el.append(ring, ringLate, core);
  return el;
}
