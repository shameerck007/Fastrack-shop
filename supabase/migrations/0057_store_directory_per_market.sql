-- The shops row and store pages read public_store_directory(). It ran as the database owner and listed every
-- approved store, so the Saudi shop showed India's stores and the India shop showed Saudi's. It now returns only
-- the stores of the market being browsed (same rule as the product and delivery-zone rules).
-- No blank lines inside the function (the Supabase SQL editor splits on them).
create or replace function public_store_directory()
returns table (
  id uuid,
  name text,
  city text,
  logo_url text,
  cover_url text,
  tagline text,
  opening_hours jsonb,
  accepting_orders boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.name, s.city, s.logo_url, s.cover_url, s.tagline, s.opening_hours, s.accepting_orders
  from stores s
  where s.status = 'approved' and s.tenant_id = current_tenant_id();
$$;
