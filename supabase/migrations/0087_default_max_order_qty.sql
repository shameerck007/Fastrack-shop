-- Every product now has a maximum order quantity (required). It starts at the market's default, which is 2 until the admin changes it
-- (Business settings), and the supplier or FasTrack can change it per product. Safe to run more than once. No blank lines inside function bodies.

alter table company_settings add column if not exists default_max_order_qty int not null default 2 check (default_max_order_qty >= 1);

create or replace function set_default_max_order_qty()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.max_order_qty is null then
    new.max_order_qty := coalesce((select c.default_max_order_qty from company_settings c where c.tenant_id = new.tenant_id limit 1), 2);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_default_max_order_qty on products;
create trigger trg_default_max_order_qty before insert or update of max_order_qty on products for each row execute function set_default_max_order_qty();

-- Products that had no limit get the market's default.
update products p set max_order_qty = coalesce((select c.default_max_order_qty from company_settings c where c.tenant_id = p.tenant_id limit 1), 2) where p.max_order_qty is null;
alter table products alter column max_order_qty set not null;
