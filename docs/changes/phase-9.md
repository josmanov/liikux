# Phase 9 – Prices, terms, hours and offers update themselves every morning

## Why

Chain prices were typed in by hand once (`seed-chain-info.ts`, October 2026) and were out of date. Liikku changed its whole price list on 16 November 2026, Elixia's prices were 15 € higher on its own pages, and there was no place for offers at all. The daily job only *checked* values; it never fixed them.

## How it works now

Every morning GitHub runs `npm run db:refresh`, then `npm run db:verify`. No AI, no cost.

| File | Job |
| --- | --- |
| `server/src/refresh/chainSources.ts` | Where each chain publishes its prices, and a small reader for each price list (EasyFit, Fitness24Seven, Liikku, Esport, UniSport). |
| `server/src/refresh/gymParsers.ts` | Readers for gym pages (Elixia, LadyLine, Ole.Fit). They keep student and day-time-only cards out of the "hinta alkaen" price. Other chains use the earlier readers in `enrich/adapters.ts`. |
| `server/src/refresh/offers.ts` | Finds offers on the pages. Strict: the line must talk about an offer, have a number, be about training, and be in date ("voimassa 30.11. asti", "tammikuun 2027 loppuun", season words like "joulu" must match the month). |
| `server/src/refresh/apply.ts` | Safety rules: never clear a value, hold price jumps over 40 %, reject opening hours under 8 hours a day. |
| `server/src/refresh-data.ts` | The job. `--dry-run` prints everything and saves `exports/refresh-report.json`. |
| `server/src/offers.ts` | Which offers are shown: seen in the last 2 days, not past the end date, not hidden. At most 3 per gym. |
| `server/src/routes/refreshAdmin.ts` | Admin: changes, held changes (approve), undo, broken pages, hide/show offers. |

New tables: `offers`, `data_changes`, `page_health` (created by `npm run db:push`).

"Hinta alkaen" means the same thing for every chain now: the cheapest monthly price for everyone, on any contract. The gym page lists every membership with its terms (no fixed term / 12 kk, joining fee, student/senior).

`scrape-gym-prices.ts` was removed. It was an older copy of the gym readers, and it could overwrite prices with empty values.

## On the site

- **Gym page:** a "Tarjoukset nyt" box above the prices, showing the title, text, end date and a link to the terms.
- **Browse list:** a yellow "Tarjous" tag on gyms with an offer.
- **Admin `/admin/data`:** a new section "Automaattiset päivitykset".

## First dry run (17 Nov 2026, nothing written)

- 144 pages read in 48 s. 108 changes would be written and 20 held.
- **Chains:**
  - Liikku: new 16.11 price list (Perus/Laaja/Super; 34,90–47,90 €).
  - Fitness24Seven: full list with 6 and 12 kk cards and joining fee.
  - EasyFit: Basic/Plus/Premium.
  - UniSport: full list.
  - Esport: 55,90 → 79,90 € held, because the old "alkaen" price may have been for another centre.
- **Gyms:**
  - Elixia +15 € in about 30 gyms.
  - Fressi 59,90 → 49,90 € (12 kk contract price).
  - New prices and hours for LadyLine Kuopio, Oulu and Lippulaiva.
  - Forever 57 → 29 € held (Basic 12 kk).
- **Pages flagged:**
  - EasyFit Pitäjänmäki: its address now leads to the Helsinki list, so the gym may have closed.
  - foreverjoensuu.fi: no price found.
- **Offers:** 28, for example LadyLine "Syksyn aloitustarjous", Fressi "Treenimaksut tammikuun 2027 loppuun -50 %", Forever "Ensimmäiset 4 viikkoa -50 %".
