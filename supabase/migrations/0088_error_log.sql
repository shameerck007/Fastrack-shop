-- A log of the errors people actually saw (with the short reference code they were shown), so a reported problem can be found fast.
-- Anyone can add a row through report_error (it never fails the caller); only admins of the market can read the rows.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default current_tenant_id() references tenants(id),
  ref text,
  user_id uuid,
  area text,
  path text,
  message text not null,
  detail text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists error_log_created_idx on error_log (created_at desc);
create index if not exists error_log_ref_idx on error_log (ref);
alter table error_log enable row level security;
drop policy if exists tenant_fence on error_log;
create policy tenant_fence on error_log as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins read errors" on error_log;
create policy "admins read errors" on error_log for select using ((select is_admin()));
drop policy if exists "admins clear errors" on error_log;
create policy "admins clear errors" on error_log for delete using ((select is_admin()));

create or replace function report_error(p_ref text, p_area text, p_path text, p_message text, p_detail text, p_ua text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into error_log (tenant_id, ref, user_id, area, path, message, detail, user_agent)
  values (current_tenant_id(), left(p_ref, 20), auth.uid(), left(p_area, 30), left(p_path, 300), left(coalesce(p_message, 'Unknown error'), 600), left(p_detail, 800), left(p_ua, 300));
exception when others then
  null;
end;
$$;
grant execute on function report_error(text, text, text, text, text, text) to anon, authenticated;
