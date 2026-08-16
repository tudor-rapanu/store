# Database Migration Policy

The current production schema workflow is `npm run db:push` against the reviewed
Neon environment. Run it from a clean working tree, inspect the generated SQL,
and take or verify a recoverable backup before applying a destructive change.

## Important limitation

`drizzle/migrations/meta/_journal.json` currently registers only migrations
`0000` and `0001`, while the repository also contains SQL files `0002` through
`0028`. Do not use `npm run db:neon:migrate` in production until those files and
the Drizzle journal have been reconciled and tested on a Neon branch. Running
the migrate command now would not provide a reliable record of the full schema
history.

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
