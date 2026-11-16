# Going live ("main") and keeping the data fresh

Everything is on the branch `upgrade/0-1-foundation-look`. Nothing is deployed yet.
Do the steps in this order. Steps marked **you** need your own accounts.

## 1. Before the merge

| # | What | Who | How |
| --- | --- | --- | --- |
| 1 | Create the new database tables | you (one command) | `npm run db:push --prefix server`. Adds `feedback`, `fact_checks`, `link_clicks`. It only adds tables; it does not touch gyms or chains. |
| 2 | First real data check | you (one command) | `npm run db:verify --prefix server`. Takes about 4 minutes. After it, gym pages show "Vahvistettu tänään". |
| 3 | Digitransit key (fast address search) | you | Register at https://portal-api.digitransit.fi (free), then set `DIGITRANSIT_API_KEY` in Render → Environment. Without it the address search uses a free public service that answers in about one second. |
| 4 | Owner name for the legal pages | you | Set `LEGAL_OWNER` as described in `client/src/features/legal/types.ts`. |

## 2. The merge

| # | What | How |
| --- | --- | --- |
| 5 | Merge the branch to `main` | Pull request on GitHub, or tell Claude "main". |
| 6 | Render deploys the API | Automatic from `main`. Check `https://liikux.fi/api/health`. |
| 7 | Deploy the Worker + site | `npm run build --prefix client`, then `npx wrangler deploy`. |

## 3. Right after

| # | What | How |
| --- | --- | --- |
| 8 | Daily check on GitHub | GitHub → Settings → Secrets → Actions → add `DATABASE_URL`. Then Actions → "Daily data check" → "Run workflow" once to see it pass. |
| 9 | Google | Search Console → Sitemaps → submit `https://liikux.fi/sitemap.xml`. Test one gym page in Google's Rich Results Test. |
| 10 | Smoke test | Open the home page, search an address, open a gym, click "Salin sivulle", save a favorite, send a test message from "Anna palautetta". |

## Keeping the data up to date

**What runs by itself:** every morning (05:00–06:00 Finnish time) GitHub runs the data check. It opens each gym's own page and confirms that the price and opening hours you show are still written there. It never changes a value.

**Your routine, about 5 minutes:**

1. Open `/admin/data`.
2. Look at "Viimeisin päivitysajo". The date must be today. If it is older, the morning job did not run: open GitHub → Actions and read the red run.
3. Choose the filter **"Robotti: hinta ei löytynyt sivulta"**. Each row shows the prices the robot saw on the page and a link to the page. Open the link:
   - the price changed → fix it in the database (your import, or ask Claude to update that gym or chain);
   - the price is right but the page is hard for a robot to read → nothing to do.
4. Read new messages from visitors ("Ilmoita virheestä") in the admin view.

**Once a week:** sort the admin table by "Tarkistettu" and look at the oldest rows. A gym that has not been confirmed for 30 days stops showing "Vahvistettu" on the site by itself, so old data is never presented as fresh.

**When a whole chain turns red at once** (like Elixia in the first run): the chain changed its prices or its website. That is one fix for many gyms, so do those first.

**What is not automatic yet:** new gyms are added by hand (from "Ehdota salia" messages), and prices are corrected by hand after the robot flags them.
