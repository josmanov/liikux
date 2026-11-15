# Liikux — the big upgrade plan

Written 15.11.2026. This plan covers the redesign, the bug fixes, the data system and the new features.

**The goal in one sentence:** someone types their address and quickly sees which gyms are near, what they really cost, which deals are on, and how they compare, both on a map and side by side.

Liikux stays a small project. Every change should be something you can explain to another junior dev in five minutes.

---

## 0. How we work (your review loop)

- Each phase gets its own branch, e.g. `upgrade/1-design`.
- Each branch is deployed to a **Cloudflare preview URL**, and the live site is not touched. You click around on desktop and mobile, then say "ok" or "change X". **Nothing gets committed to `main` until you approve it.**
- Each phase ships with a short `docs/changes/phase-N.md` with three parts: *what changed, how it works, and which files to read first*. That doc is how you explain the work to others.
- Live data only. There is no mock data anywhere.

---

## 1. What I found (checked on the live site and in the code)

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | Address search sometimes "completely broken" or slow | You are already on Render's paid plan, so it is **not** a cold start. When I tested on desktop the selector worked: ~200 ms, suggestions appeared, and picking one updated the list. The slowness is the extra hop (browser → Render → Photon/komoot, a free public server that is sometimes slow or rate-limited). The "broken" case still has to be reproduced. Phase 0 starts by testing it on mobile, with Enter instead of clicking, and in the home page box | Digitransit geocoder + edge caching, and find and fix the broken case |
| 2 | Wrong address order | "Hämeentie 5" lists **Forssa first** while you are in Helsinki, and the plain "Hämeentie 5, Helsinki" is missing (only 5a/5b show) | Digitransit (Finnish addresses, free key), biased to your current city |
| 3 | Browse feels slow and uneven | Measured in Phase 0: most calls take ~0.1 s, but a call after the database has been idle took **4.8 s** (Neon waking up). The gym list is 1.1 MB raw but only ~120 KB compressed | Done in Phase 0: background-refresh cache + edge cache. The light list endpoint was postponed to Phase 2 (small gain, risky) |
| 4 | Changing *Etäisyys* updates the map instantly but the list a second later | The list and the map compute the filter separately, and the list is deferred (`startTransition`) | One shared filtered result that both read in the same render |
| 5 | Gym page on mobile is broken | A dark veil covers the top of the page, and the header gets drawn again **in the middle of the page** when scrolling | Rebuild the detail page (§4.4) |
| 6 | Wrong logo | The header uses `liikux-logo-light.png` on a dark background, and the image has black edges | New logo exports (§9), one `<Logo>` component that picks the right version |
| 7 | Map looks dull and labels appear late | It uses the CARTO "Positron" grey style. CARTO's free basemaps are also **not meant for commercial use**, which matters once sponsors arrive | Our own map style in Liikux colours, on OpenFreeMap (free, commercial use OK, no key) |
| 8 | Popups everywhere (chains, favorites, filters) | Historical | Real pages with real URLs (§4) |
| 9 | Layout leaks and scrolls for no reason | Heights are set in many places | One "app shell": header + `100dvh` grid, and only the list scrolls (§4.2) |
| 10 | Google barely sees the site | The sitemap has 102 URLs, **0 gym pages**, and every page is client-rendered | Worker adds SEO data per page, plus a full sitemap (§5) |
| 11 | Files too big to understand | `GymsPage.tsx` is 2,276 lines, `BrowsePins.css` 2,071 lines | The rebuild splits them naturally into features |
| 12 | Favorites: no "remove all", ugly popup | — | A favorites page with compare + map (§4.5) |

---

## 2. Design direction

**Today:** dark navy everywhere and yellow on everything, so nothing stands out and it feels heavy.

**Proposal (light, calm, trustworthy, like a comparison site):**

| Token | Use | Value (starting point) |
|---|---|---|
| `--bg` | page background | warm off-white `#F7F5F0` |
| `--surface` | cards, panels | `#FFFFFF` |
| `--ink` | text, primary buttons | near-black `#14161A` |
| `--muted` | secondary text | `#5B6270` |
| `--line` | borders | `#E6E2D9` |
| `--brand` | Liikux yellow: logo, map pins, small highlights only | `#FFC83D` |
| `--good` | "verified", free trial | deep green `#1F7A4D` |
| `--warn` | "trial becomes paid" | amber on cream |

Rules:
- Yellow is a **highlight, not a background**. Yellow text on white is unreadable, so primary buttons are ink-black with white text.
- Dark mode comes later as a second set of the same tokens, so nothing gets designed twice.
- Fonts: keep **Plus Jakarta Sans** for everything. Use Fredoka only in the logo. This removes one font download.
- All colours, spacing, radii and shadows live in one file, `client/src/styles/tokens.css`. That file is the first thing to show when explaining the design.

> ✅ Changed after the first preview: the light version looked too much like Salihaku and the logo did not suit it, so Liikux is **dark graphite + yellow as the action colour** (see `client/src/styles/tokens.css`). The table above was the first idea. Favicon: yellow icon everywhere.

---

## 3. New site map (pages instead of popups)

| URL (fi / en) | Page | New? |
|---|---|---|
| `/` | Home: address box, "how it works" in 3 steps, deals near you, popular chains, cities | redesign |
| `/fi/kuntosalit/...` | Browse: list + map | rebuild |
| `/fi/sali/:slug` | Gym page | rebuild |
| `/fi/ketjut` | All chains, as a grid | **new** (was a popup) |
| `/fi/ketju/:slug` | One chain: prices, gyms on a map, deals | **new page** |
| `/fi/suosikit` | Favorites: compare table + map + distance to your places | **new** (was a popup) |
| `/fi/vertaa?salit=a,b,c` | Compare 2–4 gyms side by side, shareable link | **new** |
| `/fi/tarjoukset` | All active deals, sorted by city and expiry | **new** |
| `/fi/ilmainen-kokeilu` | Gyms with a free trial | **new** |
| `/fi/alue/:city/:area` | Area pages (Kallio, Tikkurila…), mainly for Google | **new** |
| `/fi/kaupat` | Gym shops (Phase 7) | **new** |
| `/fi/tietoa`, `/fi/ukk` | About, how the data is checked, FAQ | **new** |
| `/fi/yrityksille` | For gyms: how to partner or advertise | **new** (Phase 7) |

Filters stay a **side panel** on desktop and a **bottom sheet** on mobile, since that is the normal pattern for filters. The chain filter becomes a searchable checklist with logos inside that panel, not a big popup.

---

## 4. Feature specs

### 4.1 "My places" (several addresses)
- You can save up to 3 places: *Koti, Työ, Koulu*, or your own label. They are stored in `localStorage` with no account.
- Each place gets its own coloured pin on the map. Every gym card shows the distance to each place: `Koti 0,4 km · Työ 2,1 km`.
- You can sort by "closest to any place" or by one specific place.
- This answers your question "is it better to go near work or near home?" directly.

### 4.2 Browse layout ("fits perfectly")
```
┌ header (64px) ─────────────────────────────┐
├ list panel (scrolls) ┬ map (fills the rest) ┤
│ search + places      │                      │
│ filter chips         │                      │
│ cards…               │                      │
└──────────────────────┴──────────────────────┘
```
- One CSS grid with `height: 100dvh`. The page itself never scrolls; only the list does.
- Mobile: a full-screen map with a draggable bottom sheet (peek / half / full), plus a list/map toggle.
- Smooth by design: filtering happens in memory on ~1,200 gyms (under 5 ms), and the list and map update in the same frame. No spinners for filters; the skeleton shows only on first load.

### 4.3 Map behaviour (so you no longer have to guess)
| Action | Behaviour |
|---|---|
| Click a pin | Select it: the pin grows and a small card appears. **The map does not move** unless the gym would sit under the card or off screen. If so, it pans just enough. Moving the map when not needed is disorienting. |
| Click a card in the list | Highlight its pin. If the pin is off screen, glide there and keep the zoom. |
| Hover a list card (desktop) | Its pin bounces or highlights. |
| Address chosen | Fit the map to the address + the ~10 nearest gyms. |
| "Show route" on a gym | Fit both points, draw a straight dashed line, and show the km. "Directions" opens Google Maps in a new tab, which is free because it is just a link. |
| Zoomed out | Clusters show a count. At city zoom, pins show the chain logo. At street zoom, price labels appear. |
| Favorites | Pins carry a small heart. They are always visible, even when filtered out. |

The map style is our own version of OpenFreeMap "Positron/Liberty": warm land, soft blue water, ink labels, and street names visible from zoom 13, all tuned in **Maputnik** (a free visual editor). The style JSON lives in the repo (`client/public/map/liikux-style.json`), so you can tweak colours yourself.

### 4.4 Gym page
Order on the page: **name + chain + address → price "from" + "Verified dd.mm." → deal (if any) → membership table → facts grid (24/7, trial, notice period, sauna, m²…) → small map with your places → "Compare with nearby gyms" (4 cards) → areas it serves.**
- The image is replaced by the chain logo on a soft brand-coloured block. Inconsistent photos look worse than none until we have real photos (§9).
- Every fact has a "verified" state: ✓ verified, *not verified yet*, or hidden. This is honest, and it is what makes users trust the site.
- On mobile: one column, a sticky bottom bar with **[Gym's site ↗] [♡] [Compare]**.

### 4.5 Favorites page + compare
- A table with gyms as columns and rows for price, trial, 24/7, notice period, deals and distance to each of your places. The best value in each row is highlighted.
- A map below with only the favorites + your places.
- **"Remove all"** asks for confirmation ("Remove 5 favorites? This can't be undone.") and offers an *Undo* toast for 5 seconds.
- A "Share" button copies a `/fi/vertaa?salit=…` link.

---

## 5. Google / SEO

1. **Per-page meta in the Worker.** `worker.js` sees `/fi/sali/:slug`, fetches that gym from the API (cached at the edge) and uses Cloudflare's `HTMLRewriter` to fill in `<title>`, description, canonical, OG tags and **JSON-LD** (`ExerciseGym` with address, geo, opening hours and priceRange). This is about 80 lines, needs no framework change, and Google sees real content.
2. **Full sitemap** generated by the Worker from the database: every gym, chain, city and area page in fi + en, which comes to roughly 3,000 URLs.
3. **Google Search Console:** you verify the domain and submit the sitemap (§9).
4. **Favicon in Google results:** Google uses the **same** `rel="icon"` that browser tabs use. There is no separate "search icon", so you cannot have yellow in Google and white in the tab with certainty. Two options:
   - **A (recommended):** a yellow rounded square with a dark smile everywhere. It is readable on light and dark tabs and in Google.
   - **B:** an SVG favicon that switches with the browser theme for tabs, plus a yellow PNG. Google *may* still pick the SVG, so this is not guaranteed.
   Google also takes days to weeks to refresh a favicon after it changes.

---

## 6. Speed and hosting

| Step | Effect | Cost |
|---|---|---|
| Light list endpoint (`/api/gyms/list`: id, slug, name, chain, lat, lng, price, flags) | 1.1 MB → ~100 KB | free |
| Cache API responses at the Cloudflare edge (`Cache-Control: s-maxage=600`) and proxy `/api/*` through the Worker | Most visits never reach Render | free |
| Geocoding via **Digitransit** (HSL/Fintraffic, Finnish addresses, free API key) with edge caching | Address suggestions in ~100–200 ms, correct Finnish ranking | free |
| API hosting | **Already fine.** You are on Render's paid plan, so it does not sleep. Nothing to change | — |

**On Google Maps API:** it is not needed. Places/Maps can cost hundreds of euros a month at scale. OpenFreeMap + Digitransit + "open in Google Maps" links cover what users need for €0.

---

## 7. Data system ("the best data, updated every day")

### How Salihaku most likely does it
Their site says prices and deals are read **from the gyms' own websites**. Each fact is marked "verified" with a date, and unverified fields are listed openly ("Emme ole vielä tarkistaneet…"). There is nothing magic about it: it is a **daily scraper + extraction + a per-field verified flag**. Deals like "Aloitusetu, voimassa 30.11." come from the chains' campaign pages, which are mostly the same page for every gym in the chain. That is how one scraper run covers hundreds of gyms.

### The Liikux version
```
GitHub Actions (cron, 05:00 every day, free)
  1. fetch     → download each source page (chain price/campaign pages + gym sites)
  2. diff      → hash the page; unchanged = skip (saves time and AI cost)
  3. extract   → chain adapter (exact parsing) OR AI extraction for independent gyms
  4. validate  → rules: price 5–300 €/kk, dates in the future, notice period 0–12 kk…
  5. save      → facts table with value + source URL + checked_at + method
  6. report    → enrich_runs row + list of changes on /admin/data
```
- **Chain adapters first.** The ~10 big chains (Fressi, Elixia, EasyFit, F24, Forever, GoFitness, Liikku, Ladyline, UniSport…) cover a large share of all gyms. Each adapter is one small file that reads that chain's price and campaign page. You already have `server/src/enrich/adapters.ts` to build on.
- **AI extraction** (Claude Haiku) only for independent gyms, and only when their page has changed. It returns strict JSON: prices, memberships, trial, notice period, hours, offer + validUntil. The cost is a few euros per month at most.
- **Field-level verification:** a new `gym_facts` table (`gym_id, field, value, source_url, checked_at, method, confidence`) and an `offers` table (`gym_id or chain_id, title, description, valid_until, source_url`). The UI shows "Verified today" per fact, exactly like the reference site.
- **Automatic cleanup:** expired offers disappear automatically. Facts not re-verified for 30 days are shown as "not verified".
- **Safety:** respect `robots.txt`, fetch at most one request per second per domain, identify the bot with a contact page, and store only facts, not copied text.
- **Your daily job:** open `/admin/data`, look at "changed today" and anything flagged as suspicious, which takes about 5 minutes.

---

## 8. Money: sponsors, referrals, shops (later phase, built so it's easy)

- **Click tracking:** every "Gym's site ↗" and "Book free trial" link goes through `/go/:gymId?src=card`. The Worker logs the click and redirects with UTM tags. This gives you real numbers to show gyms: "we sent you 340 visitors in October".
- **Campaign slots:** a gym can buy a "Featured in Vantaa" card at the top of the browse list and the home page "Deals near you". It is **always labelled "Mainos/Sponsoroitu"**, as Finnish consumer law (KKV) requires advertising to be recognisable.
- **Referrals:** start simple with a per-click or per-signup deal with each chain, tracked through the `/go/` links + UTM tags. Use a lead form ("book a trial via Liikux") only once a gym has agreed to it.
- **`/fi/yrityksille` page:** what you offer, your traffic numbers and a contact form.
- **Gym shops (`/fi/kaupat`):** Fitnesstukku, Proteinbox, MyProtein etc., as cards with affiliate links via networks like **Adtraction / Awin**, which many Nordic shops use. You apply to each programme yourself. Later, it can show "shops with campaigns" next to gym deals.

---

## 9. Manual setup only you can do

| What | Why | How |
|---|---|---|
| **Logo exports** | Wrong and cropped logo | One master SVG. Export `logo-on-dark.svg`, `logo-on-light.svg`, transparent background, no padding. Figma (free) or Inkscape. |
| **Favicon set** | Google icon | Rounded-square yellow icon with a dark smile: 48, 96, 192, 512 PNG + 180 apple-touch. realfavicongenerator.net does all sizes. |
| **Chain logos** | Inconsistent | Each logo as SVG, or 512×512 PNG with a transparent background, centred, the same visual size. I'll provide a template frame. |
| **OG image** | Link previews | 1200×630, new colours. |
| **Digitransit API key** | Address search | Register at digitransit.fi (free) and put the key in the API environment. |
| **Google Search Console** | Indexing | Verify `liikux.fi` via DNS on Cloudflare, then submit the sitemap. |
| **GitHub Actions secrets** | Daily data job | `DATABASE_URL`, `ANTHROPIC_API_KEY`. |
| **Gym photos (later)** | Nicer gym pages | Ask chains for press images (they usually have them). Store them in Cloudflare R2. |
| **Affiliate sign-ups (later)** | Shops | Adtraction/Awin account, then apply per shop. |

---

## 10. Phases (each one is a preview you approve before it goes live)

| Phase | Contents | You review |
|---|---|---|
| **0 — Foundation** | Light API endpoint, edge caching, Digitransit geocoding, `tokens.css`, app shell layout, logo/favicon wiring | Speed + search feel; nothing looks different yet |
| **1 — New look** | Colours, typography, buttons, cards, header, footer, home page redesign | The whole new style |
| **2 — Browse + map** | Custom map style, map behaviour spec, filter side panel/bottom sheet, "My places", mobile bottom sheet | The core experience |
| **3 — Pages, not popups** | Gym page rebuild, chains pages, favorites + compare | Detail and compare flows |
| **4 — Google** | Worker SEO injection, JSON-LD, full sitemap, area pages | View-source check + Search Console |
| **5 — Data v2** | `gym_facts` + `offers`, chain adapters, daily cron, verified labels, deals page, free-trial page | Admin page + "Verified today" on the site |
| **6 — Content** | About/FAQ ("how we check data"), en translations for new pages | Text |
| **7 — Partners** | `/go/` tracking, sponsored slots, `/fi/yrityksille`, shops | Business side |

Phases 0–3 change the most and are worth doing first. Phase 5 can start in parallel because it is backend only.

**Not doing (on purpose):** accounts and logins, payments, a native app, or the Google Maps API.
