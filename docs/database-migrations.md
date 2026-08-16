# Database Migration Policy

The current production schema workflow is `npm run db:push` against the reviewed
Neon environment. Run it from a clean working tree, inspect the generated SQL,
and take or verify a recoverable backup before applying a destructive change.

## Journal reconciliation (2026-08-16)

`drizzle/migrations/meta/_journal.json` used to register only migrations
`0000` and `0001`, even though the repository has SQL files through `0028`
(they were carried over from a pre-Drizzle Supabase migration history and
never went through `drizzle-kit generate`). This has been reconciled:

- Replaying all 29 SQL files against an empty database reproduces the exact
  table/column/index/policy shape of `src/lib/db/schema.ts` (verified locally
  against a disposable Postgres instance).
- The one apparent gap - 9 foreign-key constraints declared in `schema.ts`
  that none of the 29 migration files create - turned out to already exist on
  production, applied by hand (likely via `db:push`) without ever being saved
  back into a tracked migration file. Confirmed by querying
  `information_schema` on production directly; nothing was changed there.
- The journal and `meta/0028_snapshot.json` now reflect the real, verified
  schema state. `npx drizzle-kit generate` reports "No schema changes,
  nothing to migrate" against the current schema, and `npx drizzle-kit check`
  passes.

This means `drizzle-kit generate` will now compute correct incremental diffs
for future schema changes instead of trying to regenerate the full history.

**Still not done:** `npm run db:neon:migrate` tracks applied migrations in its
own table (created on first run) that production has never been initialized
with, since only `db:push` has ever been used against it. Do not run
`db:neon:migrate` against production until that tracking table is seeded to
reflect migrations `0000`-`0028` as already applied - otherwise it will try
to re-run the full history against a database that already has it.

## Safe workflow

1. Create or select a disposable Neon branch.
2. Pull its connection details into `.env.neon.local`.
3. Run `npm run db:push` and review every proposed statement before confirming.
4. Run the application smoke tests against the branch.
5. Apply the same reviewed schema change to production during a controlled
   deployment window.
6. Record the deployment and keep the previous application image available for
   rollback.

Do not edit an already-applied migration to change production state. Add a new,
forward-only change and verify it independently.

## Retired WooCommerce importer

The WooCommerce product, order, and customer migration UI and API endpoints are
disabled by default. To perform an explicitly planned repair, temporarily set
`ENABLE_WOOCOMMERCE_IMPORT=true` in the server environment. Keep the endpoints
admin-only, remove the flag after the repair, and remove or rotate the old
WooCommerce API credentials once they are no longer needed.
