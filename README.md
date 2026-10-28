# Liikux

> Finnish gym finder — compare gyms, prices, opening hours and chains across Finland.

**Live site:** [liikux.fi](https://liikux.fi)

Liikux is a Finnish gym directory where you can find nearby gyms, compare prices and opening hours, and explore gym chains on a map.

![Liikux](client/public/og-liikux.png)

## Motivation

Finding a suitable gym can take time. Information about prices, opening hours, services and gym locations is often spread across different websites.

Liikux brings this information together in one place, making it easier to discover gyms across Finland and compare available options.

The goal is to make gym discovery simpler, faster and more accessible.

## Quick Start

### Requirements

- Node.js 20+
- npm
- A PostgreSQL database (local PostgreSQL or Neon)

### Installation

Clone the repository and install dependencies:

```bash
git clone <your-repository-url>
cd <your-repository-folder>

npm install
npm install --prefix client
npm install --prefix server
```

Create the local environment files:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Set `DATABASE_URL` in `server/.env` to your PostgreSQL connection string.

Set up the database:

```bash
npm run db:push --prefix server
npm run db:seed --prefix server
```

Start the backend and frontend in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

The frontend runs at [http://localhost:5173](http://localhost:5173).

The development frontend proxies `/api` requests to `http://127.0.0.1:3001`.

## Usage

Visit [liikux.fi](https://liikux.fi) to use the live application.

Liikux lets you:

- Search for gyms by address, city or gym name.
- Browse gyms in a list or on an interactive MapLibre map.
- Filter gyms by chain, price, distance, 24/7 access, free trials and day passes.
- Open gym detail pages to view prices, opening hours, services and contact details.
- Explore gym chains and see how many gyms and cities they cover.
- Save favorite gyms locally without creating an account.
- Switch between Finnish and English.

### Environment Variables

Client variables (`client/.env`):

```dotenv
VITE_API_URL=
VITE_GA_MEASUREMENT_ID=
VITE_RELEASE_AT=
VITE_MAINTENANCE=false
VITE_MAINTENANCE_BYPASS=
```

Server variables (`server/.env`):

```dotenv
DATABASE_URL=
DATABASE_URL_POOLED=
PORT=3001
ADMIN_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`DATABASE_URL` is required for database access. `DATABASE_URL_POOLED` is optional.

`ADMIN_KEY` is required for the admin data-quality endpoints. Without it, those endpoints return `403`.

`OPENAI_API_KEY` is optional and is used by the enrichment scripts.

Google Analytics is enabled only after the user provides the required cookie consent.

## What It Does

- Search by address, city or gym name.
- Browse gyms as a list and on an interactive MapLibre map.
- Filter by chain, price, distance, 24/7 access, free trials and day passes.
- View gym pricing, opening hours, services and contact details.
- Browse gym chains and compare their coverage.
- Save favorites locally without an account.
- Use the interface in Finnish or English.
- Control analytics through cookie consent.

## Tech Stack

| Part | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, React Router, MapLibre GL, plain CSS |
| Backend | Express 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL, Neon in production |
| Deployment | Cloudflare Workers for the frontend, Render for the API |
| Data | [Lipas](https://lipas.fi/) open data and enrichment scripts |

## Repository Layout

```text
client/          React frontend
  src/
    pages/       Route screens
    features/    Browse, gym detail and related features
    components/  Shared UI
    data/        API client, types and formatting
    i18n/        Finnish and English copy
server/          Express API, Drizzle schema and data scripts
worker.js        Cloudflare Worker
scripts/         Repository maintenance scripts
docs/            Release notes, roadmap and code health
```

## Data

The production database is not included in this repository. The repository contains the Drizzle schema, seed scripts and public-data import and enrichment scripts.

- Schema: `server/db/schema.ts`
- Seed: `server/src/seed.ts`
- Lipas imports: `server/src/sync-lipas-fi.ts` and `server/src/sync-lipas-turku.ts`
- Enrichment: `server/src/enrich-gyms.ts` and `server/src/enrich/`
- Generated backups and exports are stored in the gitignored `exports/` directory.

Gym names, logos and contact details belong to their respective owners. Liikux is an independent directory and is not affiliated with the gym chains.

## Deploy

The production setup consists of:

- **Frontend:** Cloudflare Worker serving `client/dist` at [liikux.fi](https://liikux.fi).
- **API:** Render at [liikux.onrender.com](https://liikux.onrender.com).
- **Database:** Neon PostgreSQL.

Build and deploy the frontend:

```bash
npm run cf:build
npm run deploy
```

Deploy the `server/` package to Render and configure the required server environment variables. Apply the database schema before the first deployment.

## Project Status and Roadmap

Liikux was released on 10 October 2026 and is available at [liikux.fi](https://liikux.fi).

- [Release notes](docs/RELEASE-10-10.md)
- [Current todo and roadmap](docs/TODO.md)
- [Code health and line-count audit](docs/CODE_HEALTH.md)

## Code Health

The project targets approximately 300 lines per file, or 350 lines for page shells.

Review the audit in [docs/CODE_HEALTH.md](docs/CODE_HEALTH.md).

Run the line-count check:

```bash
npm run check:lines
```

Use strict mode to fail when a file exceeds the configured target:

```bash
npm run check:lines -- --strict
```

## Contributing

Contributions are welcome. To contribute:

1. Keep pull requests small and focused.
2. Use English commit messages, such as `fix map clusters when pins overlap`.
3. Run the following checks before opening a pull request:

   ```bash
   npm run typecheck
   npm run lint
   npm run check:lines
   ```

4. Never commit `.env` files, database dumps, API keys or other secrets.
5. Follow the existing plain-CSS and feature-folder structure.

## License

[MIT](LICENSE) © 2026 Liikux

Third-party gym names and logos are trademarks of their respective owners and are used for identification only.
