# Phase 7 – Partners: counted links and a page for gyms

## 1. Counted links to gyms' own sites

The "Salin sivulle" button and the website row on a gym page no longer link straight to the gym. They go through `/api/go/<gym>`, which:

1. adds 1 to today's count for that gym,
2. sends the visitor on to the gym's site, with `utm_source=liikux&utm_medium=referral` added, so the gym sees Liikux in its own statistics.

What is saved: **the day, the gym and where the link was** (button or contacts). Nothing about the visitor: no IP address, no cookie. Robots are not counted.

The visitor can only be sent to the address saved for that gym in the database, so the link cannot be misused to redirect to other sites. If the counting fails, the visitor still gets to the gym.

**Admin:** `/admin/data` has a new box "Siirtymät salien omille sivuille (30 pv)": the total and the 20 most clicked gyms. This is the number you can show a gym: "we sent you 340 visitors in October".

## 2. Page for gyms: `/fi/yrityksille` and `/en/for-gyms`

- Three live numbers (gyms, towns, chains).
- Three cards: correct your details (free), see how many visitors we send (free), extra visibility (**marked "Suunnitteilla"**, because it is not built).
- "Mitä emme tee": no hidden paid positions, no prices changed on request, no personal data for click counting.
- A contact box that opens the feedback form with a new topic, "Olen salilta". For that topic the email address is required.

Linked from the footer ("Kuntosaleille"), in the sitemap, with its own Google title.

## Files

| File | Job |
| --- | --- |
| `server/src/routes/go.ts` | The counted redirect and the admin numbers. Start here. |
| `server/db/schema.ts` | New table `link_clicks` (day, gym, place, count). |
| `worker.js` | Passes the redirect to the browser without following or caching it. |
| `client/src/data/outLink.ts` | `gymSiteLink()` builds the counted link. |
| `client/src/features/business/content.ts` | Texts of the page for gyms, fi + en. |
| `client/src/pages/BusinessPage.tsx` + `.css` | The page. |

## Not done here (when we go to "main")

- `npm run db:push --prefix server` creates `link_clicks`. Until then links still work, but nothing is counted and the admin box says so.
- The redirect was tested on this computer (API and dev site). The Worker part has not run on Cloudflare.
- Mention click counting in the privacy text if you want to be thorough: no personal data is stored, so it is short.

## Left out on purpose

- **Sponsored slots ("Mainos" cards at the top of a list).** There is no paying gym yet, and an empty or made-up ad cannot be shown on a live site. Build it when the first gym says yes; the page for gyms already collects that interest.
- **Shops page with affiliate links.** The links only exist after you have joined an affiliate network (Adtraction or Awin) and been approved per shop. Without them it would be a page of plain links.
