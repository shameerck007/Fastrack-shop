-- Admin switch for the "Shops" side of the shopping pages (the shops row on the home page, shop pages, shop names on products).
-- Empty (null) follows the market's default: shown in the marketplace markets, hidden in the Instamart-style markets.
-- Run in the Supabase SQL editor. Safe to run more than once.

alter table company_settings add column if not exists show_shops boolean;
