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

## Favorites + compare page

The heart in the header now opens a real page (`/fi/suosikit`, `/en/favorites`) instead of a popup.

- **Compare table:** one row per saved gym with price, distance from your address, opening hours and free trial. Click "Sali", "Hinta alk." or "Etäisyys" to sort. The lowest price and the shortest distance are highlighted.
- **Map:** the same gyms as price labels, plus your address as a blue dot. Pointing at a row lights up its pin; clicking a pin scrolls to its row.
- **Poista kaikki:** asks "Poistetaanko 7 suosikkia?" first, then shows "Kumoa" for 5 seconds. Removing one gym with its heart also offers "Kumoa".
- **Jaa vertailu:** copies a link like `/fi/suosikit?salit=slug,slug`. Whoever opens it sees the same list without their own favorites changing, and can save them all with one button.
- **Phones:** the map is on top and every row becomes a card.

Note: the plan said "gyms as columns". I used gyms as rows, because with 10–20 favorites columns would not fit on any screen, and rows can be sorted.

| File | Job |
| --- | --- |
| `client/src/pages/FavoritesPage.tsx` + `.css` | The page: table, actions, undo message. |
| `client/src/features/favorites/FavoritesMap.tsx` | The map with price pins. |
| `client/src/data/favorites.ts` | Unchanged: favorites are saved in the browser (localStorage). |

Removed: `components/FavoritesPopup.tsx`.

## Chains page

"Ketjut" in the header, phone menu, footer and front page now opens a real page (`/fi/ketjut`, `/en/chains`) instead of a popup.

- **One card per chain:** logo, number of gyms and cities, price range, 24/7 and free-trial tags, and the distance to the nearest gym from your address. All numbers are counted from the real gym list.
- **Search and sort:** Eniten saleja, Halvin, Lähin ("Lähin" only shows when an address is set).
- **Click a card:** opens that chain on the map (`/fi/ketju/:slug`, the browse page filtered to the chain). The header search does the same when you pick a chain.
- The line under the grid says how many independent gyms there are, with a link to browse.

| File | Job |
| --- | --- |
| `client/src/pages/ChainsPage.tsx` + `.css` | The page. |

Removed: `components/ChainPopup.tsx` and `context/ChainPopupContext.tsx`. `ChainPopup.css` stays for now because the browse page still uses some of its styles.

Phase 3 is complete: gym page, favorites + compare, chains.
