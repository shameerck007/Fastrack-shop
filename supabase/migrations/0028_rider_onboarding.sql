-- Riders had no self-serve way to apply at all — the only path to becoming
-- one was an admin hand-running SQL to insert a delivery_partners row
-- directly. This adds the same shape merchants already have (0010/0016):
-- self-serve apply -> admin reviews license -> approve promotes the
-- profile to 'rider'. Same admin session that reviews merchants reviews
-- riders too (is_admin() is the only check anywhere here, same helper the
-- merchant flow uses).

create type rider_status as enum ('pending', 'approved', 'rejected', 'suspended');

-- default 'approved' so the existing test rider (and any real rider
-- already live before this migration) isn't retroactively locked out —
-- only new self-serve applications start at 'pending'.
alter table delivery_partners add column status rider_status not null default 'approved';
alter table delivery_partners add column rejection_reason text;
alter table delivery_partners add column license_number text;
alter table delivery_partners add column license_document_path text;
-- new rows (via self-apply) shouldn't default to "online" before they're
-- even approved; a rider still has to explicitly go online themselves
-- after approval, same as today.
alter table delivery_partners alter column is_available set default false;

-- is_rider() now means "an approved, live rider", not just "profile.role
-- happens to say rider" — this one change cascades correctly through every
-- existing policy that calls it (order pool visibility, accepting orders,
-- order/history access for an active assignment) without editing each one:
-- a suspended or not-yet-approved account can no longer see or accept new
-- work. An assignment they already hold stays visible/manageable via
-- is_assigned_rider(), which is unrelated to this, so an in-flight delivery
-- isn't yanked out from under a rider mid-suspension.
create or replace function is_rider()
returns boolean as $$
  select exists (
    select 1 from profiles p
    join delivery_partners dp on dp.id = p.id
    where p.id = auth.uid() and p.role = 'rider' and dp.status = 'approved'
  );
$$ language sql stable security definer set search_path = public;

-- "riders accept available orders" (0004) never actually checked is_rider()
-- — only that rider_id = auth.uid() and the order was in the pool. Any
-- authenticated customer could self-insert an assignment row and block a
-- real rider from ever accepting that order. Tightened while touching this
-- area anyway.
drop policy "riders accept available orders" on delivery_assignments;
create policy "riders accept available orders" on delivery_assignments for insert with check (
  is_rider() and rider_id = auth.uid()
  and exists (
    select 1 from orders o where o.id = order_id and o.status in ('preparing', 'ready_for_pickup')
  )
);

-- A user can apply once (delivery_partners.id is already the primary key,
-- so a second insert for the same id just fails) and only ever insert their
-- own application starting 'pending' — they can't self-approve at insert time.
create policy "users apply as own rider" on delivery_partners for insert with check (
  id = auth.uid() and status = 'pending'
);

-- Split the old "riders update own profile" (auth.uid() = id or is_admin(),
-- no restriction on which columns) in two: admins keep unrestricted access,
-- but a rider's own self-update (toggling online/offline, pinging their
-- location) can no longer also silently flip their own `status` to
-- 'approved'. The subquery compares against the row's value as it stood
-- before this statement — the standard Postgres/RLS pattern for "this
-- column is read-only to the row's own owner".
drop policy "riders update own profile" on delivery_partners;
create policy "admins update any rider" on delivery_partners for update using (is_admin()) with check (is_admin());
create policy "riders update own operational fields" on delivery_partners for update using (
  auth.uid() = id
) with check (
  auth.uid() = id
  and status = (select dp.status from delivery_partners dp where dp.id = auth.uid())
);

-- Admin-only lookup by email, reused as-is from 0024_admin_manual_merchant
-- (admin_find_user_by_email is already generic — not merchant-specific) for
-- an admin adding a rider directly without the applicant going through /deliver.

-- License photo upload, same private-bucket shape as store-documents (0016):
-- only the applicant and admins can read it.
insert into storage.buckets (id, name, public)
values ('rider-documents', 'rider-documents', false)
on conflict (id) do nothing;

create policy "applicants upload own rider documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'rider-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners and admins read rider documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'rider-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
);

create policy "applicants delete own rider documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'rider-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
