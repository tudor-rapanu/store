# Todd's Threads Storefront

The online store for Todd's Threads: a bilingual (English / Romanian) clothing shop with its own admin panel, built on Next.js and deployed to Google Cloud Run. It replaced an earlier WooCommerce site.

## What it does

**For customers**

- Product catalog with categories (nested), variants, sizes, sale prices, size guides, publish dates and search
- Physical and digital products (digital files are downloaded from the order page)
- Cart, discount codes, and checkout in RON or EUR
- Card payments through Netopia, or bank transfer
- Shipping with Sameday, to an address or to an Easybox / PUDO locker picked on a map
- Accounts with order history, and guest orders with a private order link
- Order cancellation requests for eligible orders
- Legal pages (terms, privacy, delivery and returns) in both languages

**For admins** (`/[locale]/admin`)

- Products, categories, discounts, customers and orders
- Editing order items and payment / fulfilment status
- Generating FGO invoices and Sameday AWBs (shipping labels), which also sends the tracking email
- Settings for shipping profiles, homepage sliders and sections, size guides, and Sameday location sync
- CSV product import, plus a retired WooCommerce importer (disabled by default, see [docs/database-migrations.md](docs/database-migrations.md))

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui on Radix |
| i18n | `next-intl` (`en`, `ro`; messages in [messages/](messages/)) |
| Database | Neon Postgres via Drizzle ORM ([src/lib/db/schema.ts](src/lib/db/schema.ts)) |
| Auth | Neon Auth; admins have `role: "ADMIN"` in their user metadata |
| Client state | Zustand (cart) |
| Payments | Netopia |
| Shipping | Sameday API and locker widget |
| Invoicing | FGO |
| Email | Resend + React Email ([src/components/emails/](src/components/emails/)) |
| File storage | Cloudflare R2 (S3 API) for product images and digital files |
| Background jobs | Google Cloud Tasks, with inline fallback when not configured |
| Analytics | PostHog, gated by cookie consent |
| Legal content | Sanity, falling back to Markdown in [content/legal/](content/legal/) |
| Rate limiting | Upstash Redis, falling back to in-memory buckets |
| Hosting | Docker → Artifact Registry → Cloud Run (`europe-west4`), behind Cloudflare |

> **Note:** this Next.js version differs from older ones in a few ways. For example, middleware lives in [src/proxy.ts](src/proxy.ts). See [AGENTS.md](AGENTS.md).

## Project layout

```
src/
  app/
    [locale]/         Storefront, account, checkout and admin pages
    api/
      admin/          Admin-only endpoints
      tasks/          Cloud Tasks handlers (emails, invoices, AWBs)
      cron/           Scheduled jobs (stale Netopia orders, product publish revalidation)
      webhooks/       Netopia payment webhook
      healthz, readyz Liveness / readiness probes
  components/         UI grouped by domain (product, order, checkout, settings, ui, ...)
  lib/                Domain logic: db, auth, payments, shipping, invoices, tasks, storage, currency, ...
  proxy.ts            i18n routing, rate limiting, 410s for old WordPress URLs
content/legal/        Markdown fallback for legal pages
messages/             Translation strings
drizzle/migrations/   SQL migrations and Drizzle snapshot
scripts/              Smoke test, Artillery runner, Cloudflare rate-limit setup
tests/                unit/, integration/, load/ (Artillery profiles)
docs/                 Operational docs (see below)
```

## Getting started

Requirements: Node.js 20 or newer (CI uses 20, the Docker image uses 26), npm, and access to a Neon database. You need Docker only for load tests.

```bash
npm install
npm run dev        # http://localhost:3000
```

### Environment variables

All `.env*` files are gitignored. Put local values in `.env.local`. These files are also used:

- `.env.neon.local`: a disposable Neon branch, used by `db:push` / `db:neon:*` (create it with `npm run neon:env:pull`)
- `.env.staging.local`, `.env.production.local`: database credentials for `db:staging:push` / `db:prod:push`

In deployed environments, secrets come from Google Secret Manager ([docs/secrets.md](docs/secrets.md)).

| Group | Variables |
| --- | --- |
| Site | `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `EMAIL_FROM` |
| Database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_MAX_CONNECTIONS` (optional) |
| Auth | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` |
| Netopia | `NETOPIA_API_KEY`, `NETOPIA_SIGNATURE`, `NETOPIA_WEBHOOK_SECRET`, `NETOPIA_CONFIRM_URL`, `NETOPIA_RETURN_URL`, `NETOPIA_SANDBOX`, `NETOPIA_PENDING_TIMEOUT_MINUTES` |
| Sameday | `SAMEDAY_API_URL`, `SAMEDAY_USERNAME`, `SAMEDAY_PASSWORD`, `NEXT_PUBLIC_SAMEDAY_LOCKER_CLIENT_ID`, `NEXT_PUBLIC_SAMEDAY_LOCKER_API_USERNAME` |
| FGO | `FGO_API_BASE_URL`, `FGO_PLATFORMA_URL`, `FGO_ENV`, `FGO_TIP_FACTURA`, `FGO_TIP_FACTURA_FOREIGN`, `FGO_TVA_RATE` |
| Email | `RESEND_API_KEY` |
| Storage (R2) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL` |
| Analytics | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Background jobs | `CLOUD_TASKS_SECRET`, `CLOUD_TASKS_LOCATION`, queue names or paths ([docs/cloud-tasks.md](docs/cloud-tasks.md)), `CRON_SECRET` |
| Optional | `UPSTASH_REDIS_REST_URL` / `_TOKEN`, `SANITY_PROJECT_ID` / `_DATASET` / `_API_VERSION`, `CATALOG_REVALIDATE_SECRET`, `CF_AUTH_TOKEN` / `CF_ZONE_ID` (Cloudflare script only) |
| Retired importer | `ENABLE_WOOCOMMERCE_IMPORT`, `WOOCOMMERCE_SITE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` |

Without Cloud Tasks configured, emails, invoices and AWBs run inline in the request. Without Upstash, rate limiting is per instance.

To test Netopia webhooks locally, `npm run tunnel` exposes port 3000 through ngrok.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit tests (`node --test` + `tsx`) |
| `npm run test:integration` | Integration tests. They write to a database, so they need `TEST_DATABASE_URL` (different from `DATABASE_URL`) and `RUN_DATABASE_INTEGRATION_TESTS=true` |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:push` | Push the schema to the Neon branch in `.env.neon.local` |
| `npm run db:staging:push` / `db:prod:push` | Push the schema to staging / production |
| `npm run smoke -- --url=<url>` | Post-deploy smoke test |
| `npm run load:*` | Artillery load tests in Docker ([docs/load-testing.md](docs/load-testing.md)) |
| `npm run cloudflare:rate-limits` | Configure Cloudflare WAF rate-limit rules |
| `npm run gcloud:build` / `gcloud:deploy[:staging]` | Manual build and deploy (CI normally handles this) |

## Database

The schema is defined in [src/lib/db/schema.ts](src/lib/db/schema.ts) and applied with `drizzle-kit push`. Don't run `db:neon:migrate` against production yet. The reasons, and the safe workflow for schema changes, are in [docs/database-migrations.md](docs/database-migrations.md).

## Deployment

GitHub Actions ([.github/workflows/](.github/workflows/)):

- **Quality** runs on every PR and push to `main`: lint, type-check and unit tests.
- **Deploy** runs on push to `main`. It builds a `linux/amd64` image, pushes it to Artifact Registry, pushes the DB schema, deploys to the **staging** Cloud Run service (`todds-threads-staging`) and runs the smoke test. If the smoke test fails, it rolls back to the previous revision.
- **Production** (`todds-threads-service`) deploys only when you run the Deploy workflow manually with `confirm_production: deploy`. The production schema push runs without `--force`, so a destructive change fails the job and has to be applied by hand.

Cloud Run uses `/api/readyz` (startup) and `/api/healthz` (liveness) as probes.

## Further docs

- [docs/production-readiness-checklist.md](docs/production-readiness-checklist.md): checks before deploys, payment tests and product drops
- [docs/database-migrations.md](docs/database-migrations.md): schema change policy and migration journal status
- [docs/secrets.md](docs/secrets.md): managing secrets in Secret Manager
- [docs/cloud-tasks.md](docs/cloud-tasks.md): background job queues
- [docs/load-testing.md](docs/load-testing.md): Artillery profiles
- [documentatie-sameday.md](documentatie-sameday.md): Sameday API reference (Romanian)
