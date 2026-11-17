# Going live ("main") and keeping the data fresh

Everything is on the branch `upgrade/0-1-foundation-look`. Nothing is deployed yet.
Do the steps in this order. Steps marked **you** need your own accounts.

## 1. Before the merge

| # | What | Who | How |
| --- | --- | --- | --- |
| 1 | Create the new database tables | you (one command) | `npm run db:push --prefix server`. Adds `feedback`, `fact_checks`, `link_clicks`, `offers`, `data_changes`, `page_health`. It only adds tables; it does not touch gyms or chains. |
| 2 | First data refresh | you (two commands) | `npm run db:refresh:dry --prefix server` prints every price, hours and offer change without writing (about 1 minute). If it looks right: `npm run db:refresh --prefix server`. Big price jumps (over 40 %) are held; approve them in `/admin/data`, or run once with `-- --accept-big` if you checked them in the dry run. |
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

**What runs by itself, every morning (05:00–06:00 Finnish time) on GitHub, for free, with no AI:**

1. **Refresh** (`server/src/refresh-data.ts`). Reads each chain's price list and every gym page of chains where gyms have their own prices (Elixia, EasyFit, Fressi, Forever, LadyLine, Ole.Fit). It updates:
   - price, memberships with contract terms (12 kk / no fixed term, joining fee, student/senior), opening hours,
   - **offers**: campaigns like "1. kk -50 %" or "aloitusmaksu 0 €". They appear on the gym page and as a yellow "Tarjous" tag in the list. An offer disappears by itself when it is gone from the chain's page or its end date passes.
2. **Check** (`server/src/verify-data.ts`). Confirms the price and hours we show are written on each gym's own page, and shows "Vahvistettu tänään".

**Safety rules, so nothing wrong goes live by itself:**

- A value is never cleared: if a page gives nothing, the old value stays.
- A price that jumps more than 40 % is **held** until you approve it.
- If a chain's page stops giving prices (the chain redesigned its site), the old values stay and the chain turns red in the admin view.
- Every change is logged and can be undone with one click.

**Your routine, about 5 minutes a day (or a few times a week):**

1. Open `/admin/data` → "Automaattiset päivitykset".
2. **Odottaa hyväksyntää:** open the "lähde" link, and press "Hyväksy" if the new price is right.
3. **Ketjujen lukijat:** if a chain is red, its site changed. Ask Claude: "fix the refresh parser for <chain>". That is the only time tokens are spent: one small fix, then it runs for free again.
4. **Tarjoukset:** glance through; "Piilota" hides one that should not be shown.
5. **Muutokset:** "Peru" undoes any change that looks wrong.
6. Read new messages from visitors ("Ilmoita virheestä") in the admin view.

**What is not automatic yet:**

- Independent gyms ("Muut", about 1 280) are not refreshed. Every site is different, so they are kept up to date by the daily check and by visitor reports.
- M&M publishes prices only in a PDF, so only its offers are read.
- New gyms are added by hand (from "Ehdota salia" messages).

**When a chain changes its whole price list** (like Liikku on 16 November 2026), its price list page may move. If the chain's row turns red, update its address in `server/src/refresh/chainSources.ts`.
