<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Todd's Threads Next.js App Router storefront. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern — no provider needed). A reverse proxy routes PostHog traffic through `/ingest` to avoid ad-blockers. A server-side PostHog client (`src/lib/posthog-server.ts`) captures critical business events in Server Actions and API routes. Users are identified server-side on login and client-side on every page load via `PostHogIdentifier` in the Navbar.

| Event name | Description | File |
|---|---|---|
| `product_viewed` | Fired when a user lands on a product detail page — top of purchase funnel | `src/app/[locale]/products/[slug]/page.tsx` |
| `add_to_cart` | Fired when a user adds a product variant to their cart | `src/components/product/AddToCart.tsx` |
| `cart_item_removed` | Fired when a user removes an item from their cart via the cart sheet | `src/components/layout/CartSheet.tsx` |
| `shipping_method_selected` | Fired when the user switches between home address and Sameday Easybox delivery | `src/components/checkout/CheckoutForm.tsx` |
| `payment_method_selected` | Fired when the user switches between Netopia card and bank transfer | `src/components/checkout/CheckoutForm.tsx` |
| `checkout_started` | Fired when the user submits the checkout form | `src/components/checkout/CheckoutForm.tsx` |
| `checkout_initiated` | Server-side: Netopia payment URL successfully generated for an order | `src/lib/actions/checkout.ts` |
| `bank_transfer_order_created` | Server-side: bank transfer order successfully recorded in the database | `src/lib/actions/checkout.ts` |
| `payment_confirmed` | Server-side: Netopia webhook confirms a card payment as paid | `src/app/api/webhooks/netopia/route.ts` |
| `payment_failed` | Server-side: Netopia webhook reports a rejected payment | `src/app/api/webhooks/netopia/route.ts` |
| `user_signed_in` | Server-side: user successfully authenticates via Supabase | `src/lib/actions/auth.ts` |
| `user_signed_up` | Server-side: user successfully creates a new account via Supabase | `src/lib/actions/auth.ts` |

## Next steps

We've built some insights and a dashboard to keep an eye on user behavior:

- [Analytics basics (wizard) dashboard](https://eu.posthog.com/project/201221/dashboard/759241)
- [Purchase conversion funnel](https://eu.posthog.com/project/201221/insights/dCDndTW9) — drop-off from product view → add to cart → checkout → payment confirmed
- [Orders confirmed](https://eu.posthog.com/project/201221/insights/VdVYnCid) — card payments and bank transfers over time
- [New sign-ups](https://eu.posthog.com/project/201221/insights/hgp57ldw) — new user registrations over time
- [Payment method split](https://eu.posthog.com/project/201221/insights/8JwCCwmQ) — Netopia vs bank transfer breakdown at checkout
- [Payment success vs failure](https://eu.posthog.com/project/201221/insights/D40qFn2K) — confirmed vs failed Netopia payments

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any onboarding scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentifier` in the Navbar handles this for logged-in sessions, but verify it fires correctly after a page refresh.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
