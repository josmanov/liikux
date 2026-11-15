# Phase 3 – Gym page rebuild

## What changed

The gym page (`/fi/sali/:slug`, `/en/gym/:slug`) was rebuilt from scratch.

- **No more accordions.** Prices, opening hours, contact details and services are open cards you can read straight away.
- **Head:** chain logo, chain name (links to the chain), gym name, address, green tags (24/7, free trial, day pass) and three actions: Save, Route, Gym website.
- **Facts strip:** price from, distance from your address, opening hours, free trial. A fact we do not have says "Ei tiedossa" instead of a guess.
- **Prices card:** shows "Tarkistettu <date>" and the source link, from the real `offerCheckedAt` / `offerSourceUrl` fields.
- **Compare with nearby gyms:** the 4 closest gyms of any chain, with price and distance.
- **More from this chain:** the 6 closest gyms of the same chain plus a link to all of them.
- **Map:** stays in view on desktop while you scroll. The box on the map changes the starting address (with suggestions); the bar at the bottom shows the distance and opens the route in Google Maps.
- **Phones:** one column, and a bar fixed at the bottom with Gym website, Save and Route. The old address popup is gone. The map moves with two fingers so one finger scrolls the page.

## How it works (files)

| File | Job |
| --- | --- |
| `client/src/pages/GymDetailPage.tsx` | The page layout. Reads data from the hook and prints the sections. |
| `client/src/pages/GymDetailPage.css` | All styles for the page (`gp-` classes). |
| `client/src/features/gym-detail/hooks/useGymDetail.ts` | Loads the gym, the 4 nearest gyms and the 6 nearest gyms of the same chain. |
| `client/src/features/gym-detail/components/GymRouteMap.tsx` | The map: gym pin, start pin, address box, zoom, route bar. |

The chain logo block reuses the per-chain colour/zoom rules in `features/home/chain-tiles.css`, so a logo is tuned in one place.

Removed: `DetailAccordion.tsx`, `detailPins.ts` and the old 1500-line stylesheet.

## Not done yet (still Phase 3)

- Chains page and favorites + compare page (they are still popups).
