# Going live ("main") and keeping the data fresh

Everything is on the branch `upgrade/0-1-foundation-look`. Nothing is deployed yet.
Do the steps in this order. Steps marked **you** need your own accounts.

## 1. Before the merge

| # | What | Who | How |
| --- | --- | --- | --- |
| 1 | Create the new database tables | you (one command) | `npm run db:push --prefix server`. Adds `feedback`, `fact_checks`, `link_clicks`, `offers`, `data_changes`, `page_health`. It only adds tables; it does not touch gyms or chains. |
| 2 | First data refresh | you (one command) | `npm run db:refresh --prefix server` (about 1½ minutes). Nothing goes on the site: everything it finds waits in `/admin/tarkistus` until you approve it. |
| 3 | First data check | you (one command) | `npm run db:verify --prefix server`. Takes about 4 minutes. After it, gym pages show "Vahvistettu tänään". |
| 4 | Digitransit key (fast address search) | you | Register at https://portal-api.digitransit.fi (free), then set `DIGITRANSIT_API_KEY` in Render → Environment. Without it the address search uses a free public service that answers in about one second. |
| 5 | Owner name for the legal pages | you | Set `LEGAL_OWNER` as described in `client/src/features/legal/types.ts`. |

## 2. The merge

| # | What | How |
| --- | --- | --- |
| 6 | Merge the branch to `main` | Pull request on GitHub, or tell Claude "main". |
| 7 | Render deploys the API | Automatic from `main`. Check `https://liikux.fi/api/health`. |
| 8 | Deploy the Worker + site | `npm run build --prefix client`, then `npx wrangler deploy`. |

## 3. Right after

| # | What | How |
| --- | --- | --- |
| 9 | Daily job on GitHub | GitHub → Settings → Secrets → Actions → add `DATABASE_URL`. Then Actions → "Daily data check" → "Run workflow" once to see it pass. |
| 10 | Google | Search Console → Sitemaps → submit `https://liikux.fi/sitemap.xml`. Test one gym page in Google's Rich Results Test. |
| 11 | Smoke test | Open the home page, search an address, open a gym, click "Salin sivulle", save a favorite, send a test message from "Anna palautetta". |

## Keeping the data up to date

**Nothing on the site changes by itself.** Every morning (05:00–06:00 Finnish time) GitHub runs two jobs, for free and with no AI:

1. **Refresh** (`server/src/refresh-data.ts`) reads each chain's price list and the gym pages of chains where gyms have their own prices (Elixia, EasyFit, Fressi, Forever, LadyLine, Ole.Fit). It **collects** new prices, memberships with contract terms, opening hours and offers into a review queue. It does not change the site.
2. **Check** (`server/src/verify-data.ts`) confirms that the price and hours already on the site are still written on each gym's own page, and shows "Vahvistettu tänään".

**Your routine: open `/admin/tarkistus`** (it works on a phone too). The yellow **Esikatsele koko sivusto** button shows the whole real site with everything that waits applied (nothing is saved; a yellow ESIKATSELU bar shows on every page). On a gym card, **Esikatsele salin sivu** opens just that gym.

1. **Uudet tiedot:** one card per gym or chain. The current value is crossed out, the new one is green, and "Lähde" opens the page it came from.
   - ✓ = approve, so the new value goes on the site.
   - ✕ = reject, so the old value stays.
   - "Hyväksy tämän kaikki" approves a whole card. The chain chips plus "Hyväksy kaikki" approve one chain at a time.
   - A yellow warning means "look at this one": the price jumped more than 40 %.
2. **Uudet tarjoukset:** "Näytä sivulla" or "Hylkää". A rejected offer never comes back. An approved offer disappears by itself when it is gone from the chain's page or its end date passes.
3. **Sivuja, joita ei saatu luettua:** if a whole chain is listed, its site changed. Ask Claude: "fix the refresh parser for <chain>". That is the only time tokens are spent.
4. **Tehdyt päätökset:** "Peru" undoes anything you approved in the last 7 days.

Safety: a value is never cleared, the same change found again the next day is not added twice, and a price that already appears in the gym's own price list (another contract type) is not proposed as a change.

Also read new messages from visitors ("Ilmoita virheestä") in `/admin/data`.

**What is not automatic yet:**

- Independent gyms ("Muut", about 1 280) are not refreshed. Every site is different, so they are kept up to date by the daily check and by visitor reports.
- M&M publishes prices only in a PDF, so only its offers are read.
- New gyms are added by hand (from "Ehdota salia" messages).

**When a chain changes its whole price list** (like Liikku on 16 November 2026), its price list page may move. If the chain's row turns red, update its address in `server/src/refresh/chainSources.ts`.

## Cities

Every town with gyms has its own page (`/fi/kuntosalit/<maakunta>/<kaupunki>`) and is listed on `/fi/kaupungit`. The list of towns is made from the gyms by one command; run it after adding or moving gyms, then commit the changed file:

```
npm run db:cities --prefix server
```
