# Liikux — todo and roadmap

Updated after the 10.10.2026 release. The site is live at [https://liikux.fi](https://liikux.fi); this file tracks what comes next.

## Now

- [ ] Set `ADMIN_KEY` in the production API environment so the admin data-quality page works and anonymous requests stay blocked
- [ ] Re-run the full smoke test on `liikux.fi` after the public-repo cleanup
  - Home, address search, browse list + map, pin/cluster clicks, filters
  - One gym detail page with map and contact details
  - Chain popup, favorites popup, FI/EN switch
  - Mobile map/list layout
- [ ] Verify that the deployed build matches `main` (the live site was on an older build before the cleanup)
- [ ] Keep `docs/CODE_HEALTH.md` up to date when files are split

## Next

- [ ] Split the largest frontend files into feature modules
  - `client/src/pages/GymsPage.tsx` → page state/URL sync/selection hooks + map, filter and sheet components
  - `client/src/features/browse/css/BrowsePins.css`, `BrowseLayout.css` and `BrowseMap.css` → focused CSS modules
  - `client/src/pages/GymDetailPage.tsx` and `GymDetailPage.css` → detail sections and detail CSS
  - `client/src/pages/HomePage.tsx` and `HomePage.css` → hero, rail, lajit and cities CSS
- [ ] Add a strict line-count check to CI once the violations are gone
- [ ] Improve geocoding coverage for smaller cities and addresses
- [ ] Improve price and opening-hour coverage across the full Lipas dataset
- [ ] Add automated tests for the API list/detail endpoints and the browse filters

## Later

- [ ] Hobbies and sports facilities, not only gyms
- [ ] User accounts, server-side favorites and syncing between devices
- [ ] Image hosting for gym photos (for example S3 + CloudFront)
- [ ] Better analytics dashboards after consent
- [ ] More languages if there is demand

## Ideas / polish

- [ ] Replace the current logo with the two-dumbbell mark
- [ ] Add paging to the all-chains popup
- [ ] Add a pin hover mini-card (price is already shown)
- [ ] Refine the gym detail layout to use the same left-panel + map structure as browse
- [ ] Add a public changelog page

## Not planned for now

- Payments or bookings
- Social features or chat
- A native mobile app
