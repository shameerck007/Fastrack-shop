-- Bug fix: no RLS policy let a customer read their assigned rider's name/
-- phone (profiles) or location (delivery_partners) — the order page's join
-- silently returned null for real customer sessions. SECURITY DEFINER for
-- the same reason as is_assigned_rider/order_has_my_store_item: this
-- queries delivery_assignments + orders, so an inline EXISTS in the
-- profiles/delivery_partners policies would recurse across tables.
create or replace function is_my_orders_rider(target_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from delivery_assignments da
    join orders o on o.id = da.order_id
    where da.rider_id = target_profile_id and o.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create policy "customers read their assigned rider profile" on profiles for select using (
  is_my_orders_rider(id)
);

create policy "customers read their assigned rider location" on delivery_partners for select using (
  is_my_orders_rider(id)
);

-- Simple order chat between the customer and their assigned rider.
create table order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index order_messages_order_idx on order_messages(order_id, created_at);

alter table order_messages enable row level security;

create policy "order participants read messages" on order_messages for select using (
  is_order_owner(order_id) or is_assigned_rider(order_id) or is_admin()
);
create policy "order participants send messages" on order_messages for insert with check (
  sender_id = auth.uid() and (is_order_owner(order_id) or is_assigned_rider(order_id))
);

-- Live status updates and rider location need Supabase Realtime; no table
-- was in the publication before this.
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table delivery_partners;
alter publication supabase_realtime add table order_messages;
