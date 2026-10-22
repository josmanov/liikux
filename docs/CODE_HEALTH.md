# Liikux — code health

## File size target

The project rule is roughly **300 lines per file**, and **350 lines for page shells** under `client/src/pages/`. The target is intentionally a guideline: split a file before adding another feature to it.

Reproduce the audit:

```bash
npm run check:lines
```

Use strict mode when the backlog is cleared:

```bash
npm run check:lines -- --strict
```

## Current violations

Generated from `npm run check:lines` after restoring the 10.10 design and re-applying the public-repo cleanup.

| Lines | Target | File | Suggested split |
| ---: | ---: | --- | --- |
| 2,276 | 350 | `client/src/pages/GymsPage.tsx` | Extract URL/state sync, selection and data hooks; map, filter, list and mobile-sheet components |
| 2,071 | 300 | `client/src/features/browse/css/BrowsePins.css` | Base pins, clusters, price pills, map chrome, mobile overrides |
| 1,811 | 300 | `client/src/features/browse/css/BrowseLayout.css` | Layout grid, list, filters, popups/sheets, responsive rules |
| 1,516 | 350 | `client/src/pages/GymDetailPage.css` | Detail layout, header, info sections, map, mobile |
| 1,153 | 350 | `client/src/pages/HomePage.css` | Hero, search, cards/rail, responsive |
| 1,127 | 350 | `client/src/pages/GymDetailPage.tsx` | Detail header, offer/hours/services sections, map panel, data hook |
| 881 | 300 | `client/src/components/ChainPopup.css` | Popup shell, list, controls, animations, mobile |
| 655 | 300 | `client/src/features/browse/css/BrowseMap.css` | Map shell, chrome, region labels, mobile |
| 633 | 350 | `client/src/pages/AdminDataPage.tsx` | Admin key gate, stats header, filters, table, runs panel |
| 599 | 300 | `client/src/features/browse/hooks/useBrowseMapMarkers.ts` | Marker creation, cluster sync, pin styling, selection |
| 587 | 300 | `server/src/routes/api.ts` | Split gyms, chains, geocode and admin routes |
| 576 | 300 | `client/src/components/Header.css` | Header bar, nav, actions, responsive |
| 556 | 300 | `client/src/components/ChainPopup.tsx` | List, controls, search and item components |
| 528 | 300 | `server/src/enrich-gyms.ts` | CLI parsing, run loop, persistence, reporting |
| 458 | 300 | `server/src/enrich/adapters.ts` | Per-source adapters |
| 433 | 300 | `client/src/features/browse/hooks/useBrowseMapInit.ts` | Map setup, layers, region selection, cleanup |
| 428 | 300 | `client/src/components/HeaderSearch.tsx` | Search box, suggestions, keyboard handling |
| 425 | 300 | `client/src/components/FavoritesPopup.tsx` | Popup shell, favorite rows, empty state |
| 415 | 350 | `client/src/pages/HomePage.tsx` | Hero, search, background pattern, chain rail |
| 402 | 300 | `client/src/components/HeaderSearch.css` | Base, suggestions, mobile |
| 401 | 300 | `server/src/scrape-gym-prices.ts` | Fetch, parse, merge, report |
| 375 | 300 | `client/src/i18n/messages.ts` | Split Finnish and English message files by feature |
| 361 | 350 | `client/src/pages/AdminDataPage.css` | Gate, stats, filters, table, runs |
| 328 | 300 | `client/src/components/AreaSelect.css` | Trigger, dropdown, mobile |
| 322 | 300 | `server/src/seed-chain-info.ts` | Chain data, seed logic, reporting |
| 316 | 300 | `server/src/sync-lipas-fi.ts` | API fetch, mapping, persistence, report |
| 315 | 300 | `client/src/components/AreaSelect.tsx` | Trigger, suggestion list, geocode wiring |

## Typecheck, lint and build

Run before every release:

```bash
npm run typecheck
npm run lint
npm run build --prefix client
```

Status after the public-repo cleanup (2026-10-22):

- Client typecheck: passes.
- Server typecheck: passes.
- Client lint: no errors; several pre-existing `react-hooks/exhaustive-deps` and fast-refresh warnings are still open.
- Client production build: passes.
- `npm audit --prefix client`: 0 vulnerabilities after the non-breaking lockfile update.
- `npm audit --prefix server`: 4 moderate findings in the `drizzle-kit` → `esbuild` dev chain. The fix is a breaking `drizzle-kit` downgrade, so it is left for a separate dependency upgrade.

Keep this file in sync with the commands above.

## Public repo safety

- No `.env` files, database dumps, Neon connection strings or API keys are tracked.
- Generated exports go to `exports/`, which is gitignored.
- Local notes and private PDFs live under `.cursor/`, which is gitignored.
- Admin endpoints require `ADMIN_KEY` and return `403` when it is not configured.
- `*.pdf`, `*.pem`, `*.key`, `*.p12` and `*.pfx` are gitignored.
- The release PDF that used to be tracked has been removed from the current tree. Old commits may still contain it; see the final cleanup note.
