-- How many products sit in each category, for the admin Categories page. Runs as the signed-in user, so the market's own rules apply.
-- Run in the Supabase SQL editor. Safe to run more than once.
create or replace function category_product_counts()
returns table (category_id uuid, products int)
language sql stable set search_path = public as $$
  select p.category_id, count(*)::int from products p where p.category_id is not null group by p.category_id;
$$;
grant execute on function category_product_counts() to authenticated;
