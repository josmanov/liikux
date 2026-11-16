# Phase 8 – One map everywhere, and polish

## Maps are now the same on every page

Before, the gym page and the favorites page each had their own pins and buttons. Now all three maps share one set:

| File | Job |
| --- | --- |
| `client/src/map/gymPin.ts` | Builds a gym pin and the blue "you are here" pin. Used by browse, gym page and favorites. |
| `client/src/map/pins.css` | How pins, price labels, clusters and the + / − buttons look. Moved out of `BrowsePins.css`. |
| `client/src/map/smallMap.tsx` | Sets up the small maps like the big one: same style, cannot be dragged away from Finland, zooming out stops near the starting view, + / − and "back" buttons. |

- **Gym page:** the real pin of that gym (logo tile + price + address), the blue address pin, + / − and a "back" button. The mouse wheel zooms straight away on desktop (phones still need two fingers, so the page can scroll).
- **Favorites:** logo pins instead of price-only labels. Hovering a table row lights up its pin, and hovering a pin lights up its row. The map column now starts at the top of the page, so the whole map is on the first screen.

## Price labels on the map

- New look: dark pill with white text; yellow when the gym is hovered or selected.
- The label now moves and grows together with its pin (zoom level, hover, selected). The gap between pin and label stays the same. This is done with one CSS variable, `--pin-live`, in `pins.css`.

## Browse page

- **Filter bar:** new "Naisten" filter, and chain shortcuts fill the rest of the row. Whatever does not fit is hidden automatically.
- **Opens faster the second time:** the Finland outline and region shapes are kept in memory, and the page shows about half a second sooner (measured: about 1.0 s → about 0.55 s when re-opening).
- **Footer:** the browse page now has the footer too. Scroll down with the mouse over the list. Not on phones, where browse is full screen.

## Other

- **Address search:** known city names show at once while the address search is still loading. The search itself waits on a free public service that currently answers in about one second; the real fix is the Digitransit key (see `docs/GO-LIVE.md`).
- **Page changes:** the home page, About, For gyms, Feedback and the legal pages fade in like the other pages.
- **Home:** address box is shorter and has no "Etsi" button.
