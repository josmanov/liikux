# `_legacy` quarantine

Unused pages, components, hooks, and mock shims moved here during architecture cleanup.

Quarantined so far:

- `hooks/useBrowseMapCamera.ts` — `fitBrowseCityGyms` has no importers anywhere.

- Do **not** import these from production routes or shared components.
- Do **not** hard-delete without an explicit OK from the project owner.
- To restore: move the file back, fix its relative imports, and wire a route/import again.
