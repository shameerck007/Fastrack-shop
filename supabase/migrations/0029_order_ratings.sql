-- "Rate your order" — a single post-delivery satisfaction rating + optional
-- comment, same shape as Swiggy/Instamart's rating prompt. Deliberately a
-- separate table from `reviews` (0001/0006): reviews are per-product and
-- product_id is not-null there, which doesn't fit "rate the delivery
-- experience as a whole" — this is order-level, one row per order.
create table order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- Captured at rating time from the order's delivery_assignments row,
  -- rather than joined later, so the rider's rating stays attributed
  -- correctly even if that assignment ever changes.
  rider_id uuid references delivery_partners(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create trigger order_ratings_set_updated_at before update on order_ratings
  for each row execute function set_updated_at();

create index order_ratings_rider_idx on order_ratings(rider_id);

alter table order_ratings enable row level security;

-- A customer can only rate their own order, and only once it's actually
-- delivered — same guard Swiggy/Instamart apply (no rating a trip in
-- progress).
create policy "customers rate own delivered orders" on order_ratings for insert with check (
  user_id = auth.uid()
  and exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'delivered')
);

create policy "customers read own order ratings" on order_ratings for select using (
  user_id = auth.uid() or is_admin()
);

-- Lets someone revise a rating shortly after submitting, same as Swiggy's
-- edit window — not time-limited here since order_ratings is low-stakes
-- feedback, not something that needs a hard cutoff.
create policy "customers update own order rating" on order_ratings for update using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- Rolls each new/changed order rating into the rider's delivery_partners.rating
-- column automatically — the rider dashboard (RiderProfileCard/RiderStatsGrid)
-- already reads that column, so it goes from always-null to a real average
-- with zero changes needed there.
create or replace function update_rider_rating()
returns trigger as $$
begin
  if new.rider_id is not null then
    update delivery_partners
    set rating = (select round(avg(rating)::numeric, 2) from order_ratings where rider_id = new.rider_id)
    where id = new.rider_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger order_ratings_update_rider_rating
  after insert or update of rating on order_ratings
  for each row execute function update_rider_rating();
