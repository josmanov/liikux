# Phase 5 – Data that is checked every day

## The idea: check, don't guess

Every gym in the database already has a price, opening hours and the address of the page the price came from. The old robot (`enrich-gyms.ts`) tried to *find* prices by guessing pages, and got it right for very few gyms.

The new robot does something simpler and safer. Once a day it opens the gym's own page and asks one question: **"is the price we show still written here?"** Same for the opening hours. It never changes a price. It only writes down the answer.

| Answer | Meaning |
| --- | --- |
| `confirmed` | The value is on the page today. |
| `not_found` | The page opened, but the value is not on it. A person should look. |
| `unreachable` | The page did not open, or it is a PDF. |
| `blocked` | The site's robots.txt does not allow robots there. |
| `no_source` | We have no page to check. |

## First real run (16.11.2026, dry run, nothing saved)

All 1,257 gyms, 3 min 52 s:

| | confirmed | not found | did not open | blocked |
| --- | --- | --- | --- | --- |
| Price | 913 | 183 | 5 | 1 |
| Opening hours | 1,008 | 128 | 5 | 1 |

Worth a look by hand: **all Elixia gyms**. Their pages now show prices exactly 15 € higher than ours (for example ours 64,90 €, page 79,90 €). Either the prices went up or the page shows a different contract length.

## What the visitor sees

On a gym page, next to "Jäsenyydet ja hinnat" and "Aukioloajat": **"Vahvistettu tänään"** (or "eilen", "3 pv sitten") when the robot found the value on the gym's page within the last 30 days. Otherwise the page shows the old "Tarkistettu <date>" as before. A "not found" is never shown to visitors, because it often just means the page is built in a way the robot cannot read.

## What you see

`/admin/data` has two new columns, "Robotti: hinta" and "Robotti: aukiolo", and two new filters. "Robotti: hinta ei löytynyt sivulta" is your daily list. Each row shows the prices the robot did see on the page and a link to it.

## Files

| File | Job |
| --- | --- |
| `server/src/verify-data.ts` | The daily job. Start reading here. |
| `server/src/verify/politeFetch.ts` | Downloads a page politely: says it is LiikuxBot, obeys robots.txt, waits 1 s between requests to the same site. |
| `server/src/verify/match.ts` | "Is this price / these hours in this text?" Also understands a monthly price worked out from a 3, 6 or 12 month card (380 € a year = 31,67 € a month). |
| `server/src/factChecks.ts` | Reads the results for the API. |
| `server/db/schema.ts` | New table `fact_checks`: one row per gym and fact. |
| `client/src/data/freshness.ts` | Turns a check into "confirmed N days ago". |
| `.github/workflows/daily-data-check.yml` | Runs the job every morning on GitHub (free). |

## Commands

```bash
npm run db:verify:dry --prefix server
```

Prints the report and saves nothing. Add `-- --limit=50` or `-- --chain=c4` to test a part.

```bash
npm run db:verify --prefix server
```

Saves the results. Needs the `fact_checks` table first.

## Not done here (when we go to "main")

- `npm run db:push --prefix server` creates the `fact_checks` table. Until then the site works exactly as before and shows no "Vahvistettu" labels.
- Add the `DATABASE_URL` secret in GitHub so the morning job can run.
- The "Vahvistettu" label and the admin columns could not be seen with real rows yet, because the table does not exist.

## Left out of this phase on purpose

- **Changing prices automatically.** The robot flags, a person decides. Wrong prices on a live site are worse than a short review list.
- **Campaign offers ("−50 % until 30.11.") and a deals page.** Reading free-text campaigns reliably needs AI extraction and an API key, which is not set up. No offers are shown rather than made-up ones.
