# Phase 6 – Content: About page and FAQ

## What is new

**A new page: `/fi/tietoa` and `/en/about`.**

1. Title, a short lead and three live numbers (gyms, towns, chains) from `/api/stats`.
2. "Näin tiedot syntyvät": three steps. Where gyms come from, where prices come from, and the daily check.
3. "Usein kysyttyä": seven questions that open when clicked. What "Vahvistettu tänään" means, what a "from" price is, why some prices are odd numbers (31,67 €), why a gym says "Ei tiedossa", what to do when something is wrong or missing, and where favorites are saved.
4. A band with "Ehdota salia", "Ilmoita virheestä" and "Selaa saleja".

**Links to it:** the footer ("Tietoa ja usein kysyttyä") and every gym page, under the prices ("Näin tarkistamme tiedot"). The old `/about` address now goes there.

**Google:** the page is in the sitemap and has its own title and description in the Worker.

## A fix found on the way

The number of chains was 12 on the home page and 11 on the chains page. One chain in the database has no gyms. `/api/stats` now counts only chains that have gyms, so both say 11.

## English

All texts on the new pages (gym page, favorites, chains, feedback) already had English versions: the two languages have exactly the same list of text keys, and TypeScript refuses to build if one is missing. Nothing needed translating.

## Files

| File | Job |
| --- | --- |
| `client/src/features/about/content.ts` | All the texts, Finnish and English. Edit here. |
| `client/src/pages/AboutPage.tsx` + `.css` | The page. |
| `client/src/i18n/lang.ts` | `pathAbout()` and the language switch for this page. |
| `worker/seo.js`, `worker/places.js` | Title/description and sitemap entry. |

## Keep in mind

The page says the data is checked **once a day**. That becomes true when the daily check from Phase 5 is switched on (the `fact_checks` table and the GitHub schedule, both part of going to "main"). Do not publish this page before that.
