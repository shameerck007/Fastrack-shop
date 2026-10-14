-- Admin-managed home page slider.
--  * home_banners: one row per slide of the shop home page carousel (per market). When a market has at least one banner that is
--    switched on and inside its dates, the shop shows those; otherwise it falls back to the built-in slides.
--  * A banner is either text on a coloured theme with a small photo collage (photos), or text over one uploaded picture (image_url).
--  * Arabic title, subtitle and button text are optional; the English text is shown when they are empty.
-- Safe to run more than once.

create table if not exists home_banners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  eyebrow text,
  title text not null,
  title_ar text,
  subtitle text,
  subtitle_ar text,
  cta_label text,
  cta_label_ar text,
  link_url text,
  theme text not null default 'blue' check (theme in ('blue', 'green', 'orange', 'teal')),
  image_url text,
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists home_banners_tenant_idx on home_banners (tenant_id, is_active, sort_order);

alter table home_banners enable row level security;
drop policy if exists tenant_fence on home_banners;
create policy tenant_fence on home_banners as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins manage home banners" on home_banners;
create policy "admins manage home banners" on home_banners for all using ((select is_admin())) with check ((select is_admin()));
drop policy if exists "anyone reads live home banners" on home_banners;
create policy "anyone reads live home banners" on home_banners for select
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
