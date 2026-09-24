# FasTrack Shop

Quick-commerce grocery delivery for Riyadh, Saudi Arabia. Phase 1 MVP per the
business requirements in `BRD_shop.pdf`: customer ordering, admin catalog/order
management, and rider delivery with OTP confirmation.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Postgres, Auth, Row Level Security)

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in your project URL and anon key
   (Project Settings → API).
3. Run the schema migration against your project (SQL editor, or via the
   Supabase CLI):
   - `supabase/migrations/0001_init.sql` — tables, RLS policies, triggers.
   - `supabase/seed.sql` — sample categories/products for local development.
4. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

### Creating an admin or rider account

New sign-ups default to the `customer` role (see the `handle_new_user` trigger
in the migration). To promote an account, run in the Supabase SQL editor:

```sql
update profiles set role = 'admin' where id = '<user-uuid>';
-- or
update profiles set role = 'rider' where id = '<user-uuid>';
insert into delivery_partners (id) values ('<user-uuid>');
```

## Project structure

```
src/
  app/                 Routes: customer storefront, /admin, /rider
  components/          UI components (customer, admin/, rider/)
  lib/
    supabase/          Browser/server Supabase clients
    actions/           Server actions (cart, orders, addresses, admin, rider)
    catalog.ts, cart.ts, orders.ts, addresses.ts, auth.ts  Data access helpers
  types/database.ts    Hand-written types matching the SQL schema
supabase/
  migrations/0001_init.sql   Full Phase 1 schema + RLS
  seed.sql                   Sample catalog data
```

## What's implemented (Phase 1, per BRD §32)

- Customer: registration/login, category browsing, search, product pages,
  cart, checkout (address, delivery window, payment method), order
  confirmation, live status tracking, delivery OTP.
- Admin: dashboard stats, product/inventory management, order status board.
- Rider: assigned orders, mark picked up / out for delivery, OTP-verified
  delivery completion.

## Not yet built (later phases)

Multi-vendor marketplace, promotions/coupons UI, loyalty/wallet, AI search
and shopping assistant, route optimization, subscriptions — see `BRD_shop.pdf`
§§26–30, 33–34 for the full roadmap. The database schema already has room for
promotions, reviews, and payments/refunds tables to build on.
