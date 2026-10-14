-- Home banners can be "auto": the shop builds the slide from live catalog data (fresh today, deals, free delivery, welcome, best sellers).
-- The text fields then only hold optional wording overrides, so title becomes optional for auto banners.
-- Safe to run more than once.

alter table home_banners add column if not exists kind text not null default 'custom' check (kind in ('custom', 'auto'));
alter table home_banners add column if not exists auto_type text check (auto_type in ('welcome', 'fresh_today', 'deals', 'free_delivery', 'best_sellers'));
alter table home_banners alter column title drop not null;
alter table home_banners drop constraint if exists home_banners_kind_ck;
alter table home_banners add constraint home_banners_kind_ck check (
  (kind = 'custom' and title is not null and auto_type is null) or (kind = 'auto' and auto_type is not null)
);
