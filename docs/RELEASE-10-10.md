# Liikux — 10.10.2026 release

**Released:** 10 October 2026  
**Live at:** [https://liikux.fi](https://liikux.fi)

Liikux started as a local practice project and shipped its first public release on 10.10.2026. The release is a Finnish gym directory: find a gym near you, compare prices and opening hours, browse chains and open a detail page for each gym.

## What shipped

### Home

- Address/city search with autocomplete
- “Use my location” shortcut
- Centered hero with the Liikux title and popular gym chains rail
- Gym/chain/city stats line under the search

### Browse

- Split list + MapLibre map view
- Gym pins, chain logos, clusters and price pills
- Filters for chain, price, distance, audience, 24/7 access, free trial and day passes
- Region and city filtering
- Sorting by distance, price and name
- Mobile map/list layout
- Selected-gym preview and list-to-map synchronization

### Gym detail

- Price and membership information
- Opening hours
- Services
- Contact details with copy actions
- Address and map view
- Link to the gym’s own website

### Chains and favorites

- Chain list with gym and city counts
- Chain view with the chain preselected as a filter
- Favorites popup backed by `localStorage` (no account needed)

### Platform

- Finnish and English routes and UI copy
- Cookie consent with Google Analytics enabled only after consent
- SEO metadata, canonical URLs, `robots.txt` and `sitemap.xml`
- Express + Drizzle API with in-memory caching and rate limiting
- Neon PostgreSQL in production

### Deployment

- Frontend: Cloudflare Worker serving `client/dist` at `liikux.fi`
- API: Render at `liikux.onrender.com`
- Database: Neon PostgreSQL
- Domain and coming-soon page replaced by the live app

## Known limitations

- Price and opening-hour coverage is not complete for every gym yet.
- Geocoding works for the main cities and addresses but is still being improved for the full dataset.
- There are no user accounts yet. Favorites are stored in the browser.
- The hobbies section is not part of the 10.10 release.
- Some frontend files are larger than the project’s 300-line target. The split plan is in [CODE_HEALTH.md](CODE_HEALTH.md).

## After 10.10

The next work is tracked in [TODO.md](TODO.md):

- Split the largest frontend files into feature modules
- Improve data coverage and geocoding for the whole country
- Add hobbies and a proper account/favorites flow
- Keep the public repo clean, documented and safe to contribute to
