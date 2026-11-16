# Phase 4 – Google / SEO

## The problem

The site is a single-page app: every address used to get the same HTML with the same title ("Liikux – yli 1000 kuntosalia…") and the same canonical address (the front page). Google saw 1,257 gym pages that all claimed to be the front page, and the sitemap listed 102 pages with no gyms at all.

## What changed

Everything happens in the Cloudflare Worker, before the page leaves Cloudflare. No framework change.

1. **Every page gets its own title, description and canonical address.**
   - Gym: "Liikku Vantaa Tammisto, Vantaa – hinnat ja aukiolo | Liikux", with address, price and hours in the description.
   - Chain: "Liikku – kaikki 37 salia ja hinnat | Liikux".
   - City: "Kuntosalit Vantaa – vertaa hintoja kartalla | Liikux" with the real gym count.
   - Region, all gyms, all chains and the English front page too.
2. **Structured data for gyms** (JSON-LD, type `ExerciseGym`): name, address, coordinates, opening hours, price and brand, plus a breadcrumb. This is what lets Google show details under a result.
3. **Finnish/English pairs** (`hreflang`) on every page, so Google shows the right language.
4. **Share previews** (WhatsApp, Slack, Facebook) show the title and description of that gym.
5. **A gym that does not exist answers 404** and is marked "noindex" instead of looking like a normal page.
6. **Favorites and admin pages are marked "noindex".**
7. **Full sitemap** at `/sitemap.xml`, built from the real data: 2,640 addresses (every gym, chain, city and region in fi + en). New gyms appear automatically.
8. **robots.txt** now also keeps crawlers out of `/api/` and `/admin`.

## A bug this fixed

`client/public/sitemap.xml` and `robots.txt` were static files. Cloudflare serves static files before the Worker runs, so the sitemap code in the Worker was never used. The static files are deleted; the Worker now answers both.

## How it works (files)

| File | Job |
| --- | --- |
| `worker.js` | Entry point: API proxy, robots, sitemap, and "fill in SEO for pages". |
| `worker/seo.js` | `pageMeta()` decides the title/description/data for an address. `applyMeta()` writes it into the HTML. |
| `worker/sitemap.js` | Builds the sitemap from `/api/gyms` and `/api/chains`. |
| `worker/places.js` | The list of regions and cities with their names. Add a city here to give it a sitemap entry and a title. |

The Worker reads gym data through the same edge cache as visitors, so this adds no load on the database. If the API is down, pages still load with the default title and the sitemap still lists the fixed pages.

## Test it locally

```bash
npm run build --prefix client
```

```bash
npx wrangler dev --port 8787 --var API_ORIGIN:http://localhost:3001
```

Then open `http://localhost:8787/sitemap.xml`, or view the source of `http://localhost:8787/fi/sali/<slug>`.

## Not done here (needs you, when we go to "main")

- Deploy the Worker, then submit `https://liikux.fi/sitemap.xml` in Google Search Console.
- Check one gym page in Google's Rich Results Test after deploy.
