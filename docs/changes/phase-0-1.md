# Phase 0 + 1 — speed, search and the new dark look

Branch: `upgrade/0-1-foundation-look` · Status: **waiting for your review (not committed)**

## In one minute

- **Faster and steadier:** the server now keeps answers in memory and refreshes them quietly in the background, so visitors no longer wait for the sleeping database. The Cloudflare worker also caches API answers close to the user.
- **Address search fixed:** typing a street name without a number used to only search *cities*, so you got "no results" while typing. Addresses near you now come first ("Hämeentie 5" in Helsinki beats Forssa). There is also optional support for Digitransit, a Finnish address service.
- **New look (round 2, after your feedback):** dark graphite background (not the old navy), warm-white text, and **Liikux yellow as the main action colour**. Content is wider (1400 px) and lines up with the header. Every colour comes from one file.
- **Home page with its own identity:** a two-column hero with a live “nearest gyms” panel (real data around your location), a numbers strip, and big chain tiles.
- **New home page, header logo, footer and favicon.**

## What changed and where

### Speed (Phase 0)

| What | File | How it works |
|---|---|---|
| Stale-while-revalidate cache | `server/src/memoryCache.ts` | Fresh answer → return it. Old answer (under 24 h) → return it **and** refresh in the background. Nothing cached → load it now. |
| Warm-up on start | `server/src/index.ts` | After the server starts it calls `/api/gyms`, `/api/chains` and `/api/stats` once, so the cache is full before the first visitor. |
| Gym page cached | `server/src/routes/api.ts` | `/api/gyms/:slug` now uses the same cache. |
| Edge cache | `worker.js` → `proxyApi()` | The browser calls `liikux.fi/api/...`. The worker checks Cloudflare's cache first and only asks Render when needed. Admin routes are never cached. The visitor IP is passed on so the rate limit stays per person. |
| Same-domain API | `client/src/data/apiBase.ts` | In production the app now calls `/api` on its own domain, which goes through the worker. |
| Retry once | `client/src/data/api.ts` → `getJson()` | If a request fails, it waits 0.7 s and tries again. One hiccup used to leave the list empty until a reload. |

**Measured:** a normal API call takes about 0.1 s. A call after the database had been idle took **4.8 s**, and that is what the background refresh removes.

**Not done:** the "light list endpoint" from the plan. The gym list is 1.1 MB raw, but only about 120 KB compressed (Brotli), and the browse cards and chain popup use most of its fields. Removing fields would risk breaking things for little gain, so it is left until the Phase 2 rebuild.

### Address search

All of it now lives in `server/src/geocode/`:

- `index.ts`: `searchAddress()` is the only function routes call. It uses Digitransit (if a key is set), falls back to Photon, then cleans up and sorts the results.
- `photon.ts`: the Photon (OpenStreetMap) search, the ranking, and reverse lookup ("what address is at this point?").
- `digitransit.ts`: Finnish address search. It is turned on by setting `DIGITRANSIT_API_KEY` in Render; without the key, nothing changes.

The ranking rules, in order: exact text match → right house number → **closest to the user** (even "5a" nearby beats an exact "5" in another town) → shorter label.

### The new look (Phase 1)

| What | File |
|---|---|
| **All colours, fonts, sizes and shadows** | `client/src/styles/tokens.css` ← start here |
| Shared buttons, chips, cards and skeletons | `client/src/styles/ui.css` (`btn btn-primary` = yellow, `btn btn-ghost`, `btn btn-dark`, `chip`, `card`) |
| Width | `--max-width: 1400px` in tokens. The header’s side padding is calculated so its edges match the content. On browse (a full-screen app view) the header goes full width (`AppLayout.css`). |
| Nearest gyms panel | `client/src/features/home/NearbyPreview.tsx` + `.css`: the 5 gyms closest to your chosen location, with price and distance |
| Map base style | one constant, `MAP_STYLE_URL` in `features/browse/utils/mapConstants.ts`, now CARTO “dark matter” (temporary until Phase 2’s own style) |
| Old variable names (`--color-bg` …) | mapped to the new tokens at the bottom of `tokens.css`, so old CSS keeps working |
| Hard-coded colours in old CSS | converted to tokens by a one-off script. It looked at the property (`color` vs `background` vs `border`) to choose the right token. Text on yellow or on white pins uses `--on-primary` / `--on-ink`, so it stays dark. |
| Home page | `client/src/pages/HomePage.tsx` + `.css`, search box in `client/src/features/home/HomeSearch.tsx` + `.css` |
| Header logo / footer | `components/Header.tsx`, `components/Footer.tsx` + `.css` |
| Header height | now exactly `--header-h` (`AppLayout.css`), so the browse page fits the screen without a scrollbar |
| Cookie banner | now a card at the bottom, and the page stays usable (it used to block the whole screen) |
| Map credits | the browse map hid the OpenStreetMap credit, which the licence requires. It is now a small (i) button. |
| Map overlay colours | `useBrowseMapInit.ts`: the area outside Finland, region borders and labels are recoloured for the light theme |

### Logo and favicon

- `client/public/brand/logo-white.png` (used in the header and footer) and `logo-ink.png` (for light backgrounds) were cut cleanly out of the old logo: transparent background, no black edges, no padding.
- `client/public/brand/favicon-*.png`, `apple-touch-icon.png` and `favicon.ico`: a **yellow rounded square with a dark smile**, used in the browser tab and in Google.
- `client/index.html` now points to these. Google can take days or weeks to show the new icon.
- Removed `client/public/favicon.svg`, which was Vite's default purple logo.

## How to test it yourself

1. Run the API and the site (both read from the real database; nothing is written):
   ```bash
   npm run dev:server
   ```
   ```bash
   npm run dev:client
   ```
2. Open http://localhost:5173 and try:
   - Home: type "Hämeentie" (no number) and check that streets appear. Type "Hämeentie 5" and check that Helsinki comes first. Pick an address and check that the “nearest gyms” panel updates.
   - The city chips, the chain cards (they open that chain on the map), the footer links
   - Browse: filters, the list and the map. On a phone-sized window, the map/list toggle.
   - A gym page: the price is readable, the black button, the Google Maps icon is visible
   - The location picker top left, the favorites and chains popups, the mobile menu

## Still old (comes in later phases)

- Map pins and clusters, plus the map style itself (Phase 2)
- Chains, favorites and filter popups → real pages (Phase 3)
- Gym page layout (Phase 3); it only got the new colours for now

## Round 3 (after your second review)

| Change | Where |
|---|---|
| Hero back to the **centered** first style. No glow. A faint pattern of **your own gym icons** (`public/bg-icons/*.png`) sits behind it. | `features/home/GymPattern.tsx` + `.css` |
| "Nearest gyms" panel **removed**: it needs an address first, so it belongs on browse, not the front page. | — |
| Numbers strip now shows **real, useful data**, and each tile opens browse with that filter: gyms (+ cities), 24/7 gyms (`?247=1`), free trials (`?trial=1`), average monthly price (`?sort=price-asc`). "0 €" removed. | `pages/HomePage.tsx` → `useHomeData()` |
| Chain tiles use **your original tuning** again: the tile background is the image's own brand colour (measured from the image edges) and each chain has its own zoom. `logoFit="contain"` chains show the whole image first. Same 16:10 tile as before. | `features/home/chain-tiles.css` |
| **Suggest a gym / report an error**: a new page `/fi/palaute` (`/en/feedback`) with three topics. Links to it are on the home page, footer, mobile menu, browse list end ("Puuttuuko sali?") and every gym page ("Onko tiedoissa virhe?", with the gym pre-filled). | `pages/FeedbackPage.tsx`, `i18n/lang.ts` → `pathFeedback()` |
| Feedback API: `POST /api/feedback` stores messages in a new `feedback` table (max 5 per minute per visitor, hidden "honeypot" field against bots). `GET /api/admin/feedback?key=ADMIN_KEY` lists them. | `server/src/routes/feedback.ts`, `server/db/schema.ts` |
| Footer: suggest/report buttons, columns for finding a gym, cities, and info (feedback, terms, privacy, cookies, cookie settings, language). | `components/Footer.tsx` + `.css` |

**Before the form works:** the `feedback` table must exist in the database. Create it with:

```bash
npm run db:push --prefix server
```

## Round 4 (after your third review)

| Change | Where |
|---|---|
| Home "suggest / report" section **removed**. Instead two simple buttons in the header, **Puuttuuko sali?** and **Ilmoita virheestä** (icon-only on medium screens), plus the same two in the phone menu. Footer keeps them as plain links. | `components/HeaderFeedbackLinks.tsx` + `.css`, `Header.tsx` |
| Icon background pattern **removed** (it reused old project icons). The floating emoji tags tried next were removed too: the hero is clean, just text, search and city chips. | `pages/HomePage.tsx` |
| Chain tiles made **smaller**: 6 in a row on desktop (3 on tablets, 2 on phones), smaller text. | `features/home/chain-tiles.css` |
| **Legal pages rewritten** to match what the site really does: who runs it, data sources (Lipas CC BY 4.0, OpenStreetMap ODbL), what data is processed and why (table with legal basis + retention), every third party (Cloudflare, Render, Neon, Digitransit/Photon/Nominatim, CARTO, Google Fonts, Google Analytics), EU transfers, your rights, and a full list of everything stored on your device. | Texts: `features/legal/fi.ts`, `en.ts`. Page: `pages/LegalPage.tsx` |

**Owner to-dos for the legal pages**
- Put your name or company name + business ID in `LEGAL_OWNER` (`features/legal/types.ts`). GDPR requires the controller to be named.
- The privacy text promises to keep feedback for **at most 24 months**. Delete older rows from the `feedback` table, or change the number in the text.
- The font is still loaded from Google Fonts (disclosed in the text). Moving it into the site removes that IP transfer: `npm i @fontsource-variable/plus-jakarta-sans --prefix client`.
