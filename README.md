# Liikux

> Finnish gym finder — compare gyms, prices, opening hours and chains across Finland.

**Live site:** [https://liikux.fi](https://liikux.fi)

Liikux on suomalainen kuntosalihakemisto: etsi sali läheltäsi, vertaa hintoja ja aukioloaikoja sekä selaa ketjuja kartalla.

![Liikux](client/public/og-liikux.png)

## What it does

- Search by address, city or gym name
- Browse gyms as a list and on an interactive MapLibre map
- Filter by chain, price, distance, 24/7 access, free trial and day passes
- Open a gym detail page with pricing, opening hours, services and contact details
- Browse gym chains and see how many gyms and cities each chain covers
- Save favorites locally (no account required)
- Finnish and English UI
- Cookie consent with analytics enabled only after consent

## Tech stack

| Part | Stack |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, React Router, MapLibre GL, plain CSS |
| Backend | Express 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL (Neon in production) |
| Deploy | Cloudflare Workers for the frontend, Render for the API |
| Data | [Lipas](https://lipas.fi/) open data plus enrichment scripts |

## Repository layout

```text
client/          React frontend
  src/
    pages/       route screens
    features/    browse, gym detail and related feature code
    components/  shared UI
    data/        API client, types, formatting
    i18n/        Finnish and English copy
server/          Express API, Drizzle schema and data scripts
worker.js        Cloudflare Worker (static assets, sitemap, robots.txt)
scripts/         repo maintenance scripts
docs/            release notes, roadmap and code health
```

## Local development

Requirements:

- Node.js 20+
- npm
- A PostgreSQL database (local Postgres or Neon)

Install dependencies:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Create local env files:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Fill in `server/.env` with your database URL. `DATABASE_URL` is required; `DATABASE_URL_POOLED` is optional. The client works with Vite's `/api` proxy during development, so `VITE_API_URL` can stay empty.

Set up the database:

```bash
npm run db:push --prefix server
npm run db:seed --prefix server
```

Run the API and the frontend in two terminals:

```bash
npm run dev:server
npm run dev:client
```

The frontend runs on `http://localhost:5173` and proxies `/api` to `http://127.0.0.1:3001`.

### Environment variables

Client (`client/.env`):

```dotenv
VITE_API_URL=
VITE_GA_MEASUREMENT_ID=
VITE_RELEASE_AT=
VITE_MAINTENANCE=false
VITE_MAINTENANCE_BYPASS=
```

Server (`server/.env`):

```dotenv
DATABASE_URL=
DATABASE_URL_POOLED=
PORT=3001
ADMIN_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`ADMIN_KEY` is required for the admin data-quality endpoints. If it is not set, those endpoints return `403`. `OPENAI_API_KEY` is optional and only used by the enrichment scripts.

No secrets or production database dumps are committed to this repository.

## Data

The production database is **not** included in this repository. Only the Drizzle schema, seed scripts and public-data import/enrichment scripts are committed.

- Schema: `server/db/schema.ts`
- Seed: `server/src/seed.ts`
- Lipas imports: `server/src/sync-lipas-fi.ts`, `server/src/sync-lipas-turku.ts`
- Enrichment: `server/src/enrich-gyms.ts` and `server/src/enrich/`
- Generated backups and exports go to `exports/`, which is gitignored

Gym names, logos and contact details belong to their respective owners. Liikux is an independent directory and is not affiliated with the gym chains.

## Deploy

The production setup is:

- **Frontend:** Cloudflare Worker serving `client/dist` at `https://liikux.fi`
- **API:** Render at `https://liikux.onrender.com`
- **Database:** Neon PostgreSQL

Build and deploy the frontend:

```bash
npm run cf:build
npm run deploy
```

For the API, deploy the `server/` package to Render and set the server environment variables there. Run the Drizzle schema push/migrations against the production database before the first deploy.

## Project status and roadmap

Liikux shipped its 10.10.2026 release and is live at [liikux.fi](https://liikux.fi).

- [Release notes](docs/RELEASE-10-10.md)
- [Current todo and roadmap](docs/TODO.md)
- [Code health and line-count audit](docs/CODE_HEALTH.md)

## Code health

The project targets roughly **300 lines per file** (350 for page shells). The current large-file audit is tracked in [docs/CODE_HEALTH.md](docs/CODE_HEALTH.md), and you can reproduce it with:

```bash
npm run check:lines
```

Use `npm run check:lines -- --strict` if you want the command to fail when a file is over the target.

## Contributing

- Keep pull requests small and focused.
- Use English commit messages, for example `fix map clusters when pins overlap`.
- Run `npm run typecheck`, `npm run lint` and `npm run check:lines` before opening a PR.
- Never commit `.env` files, database dumps, API keys or other secrets.
- Match the existing plain-CSS and feature-folder structure.

## License

[MIT](LICENSE) © 2026 Liikux

Third-party gym names and logos are trademarks of their respective owners and are used here for identification only.
