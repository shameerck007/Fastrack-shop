-- Admin customer management: a customer list and detail view with contact details masked by default (only the platform super admin can
-- reveal them), support notes, blocking (a blocked customer cannot place orders), and an audit log of who looked at or changed what.
-- Customer map pins are never returned. Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

alter table profiles add column if not exists blocked_at timestamptz;
alter table profiles add column if not exists blocked_reason text;
alter table profiles add column if not exists blocked_by uuid references profiles(id) on delete set null;

create or replace function is_platform_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'super_admin');
$$;

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  customer_id uuid not null references profiles(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on customer_notes (customer_id, created_at desc);
alter table customer_notes enable row level security;
drop policy if exists tenant_fence on customer_notes;
create policy tenant_fence on customer_notes as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins read customer notes" on customer_notes;
create policy "admins read customer notes" on customer_notes for select using ((select is_admin()));

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_id, created_at desc);
create index if not exists admin_audit_log_tenant_idx on admin_audit_log (tenant_id, created_at desc);
alter table admin_audit_log enable row level security;
drop policy if exists tenant_fence on admin_audit_log;
create policy tenant_fence on admin_audit_log as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "super admins read audit log" on admin_audit_log;
create policy "super admins read audit log" on admin_audit_log for select using ((select is_platform_super_admin()));

create or replace function admin_customers(p_q text default null, p_filter text default 'all', p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_total int;
  v_items jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can view customers.';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%';
  end if;
  select count(*) into v_total
  from profiles p
  left join auth.users u on u.id = p.id
  where p.role = 'customer' and (p.tenant_id = current_tenant_id() or is_super_admin())
    and (v_q is null or p.full_name ilike v_like or p.phone ilike v_like or u.email ilike v_like
         or exists (select 1 from orders o where o.user_id = p.id and o.order_number ilike v_like))
    and (p_filter = 'all' or p_filter is null
         or (p_filter = 'new' and p.created_at > now() - interval '30 days')
         or (p_filter = 'blocked' and p.blocked_at is not null)
         or (p_filter = 'never' and not exists (select 1 from orders o where o.user_id = p.id))
         or (p_filter = 'repeat' and (select count(*) from orders o where o.user_id = p.id and o.status <> 'cancelled') >= 2));
  select coalesce(jsonb_agg(x.j order by x.last_order desc nulls last, x.joined desc), '[]'::jsonb) into v_items
  from (
    select
      s.last_order, p.created_at as joined,
      jsonb_build_object(
        'id', p.id,
        'name', p.full_name,
        'phone_masked', case when p.phone is null or p.phone = '' then null else left(p.phone, 4) || repeat('•', greatest(char_length(p.phone) - 7, 3)) || right(p.phone, 3) end,
        'email_masked', case when u.email is null then null else left(u.email, 1) || '•••' || substring(u.email from position('@' in u.email)) end,
        'city', (select a.city from addresses a where a.user_id = p.id order by a.is_default desc, a.created_at desc limit 1),
        'orders', s.orders, 'spent', s.spent, 'last_order_at', s.last_order,
        'joined_at', p.created_at, 'blocked', p.blocked_at is not null
      ) as j
    from profiles p
    left join auth.users u on u.id = p.id
    left join lateral (
      select count(*) filter (where o.status <> 'cancelled') as orders,
             coalesce(sum(o.total) filter (where o.status = 'delivered'), 0) as spent,
             max(o.created_at) as last_order
      from orders o where o.user_id = p.id
    ) s on true
    where p.role = 'customer' and (p.tenant_id = current_tenant_id() or is_super_admin())
      and (v_q is null or p.full_name ilike v_like or p.phone ilike v_like or u.email ilike v_like
           or exists (select 1 from orders o where o.user_id = p.id and o.order_number ilike v_like))
      and (p_filter = 'all' or p_filter is null
           or (p_filter = 'new' and p.created_at > now() - interval '30 days')
           or (p_filter = 'blocked' and p.blocked_at is not null)
           or (p_filter = 'never' and s.orders = 0 and s.last_order is null)
           or (p_filter = 'repeat' and s.orders >= 2))
    order by s.last_order desc nulls last, p.created_at desc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) x;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;
grant execute on function admin_customers(text, text, int, int) to authenticated;

create or replace function admin_customer_detail(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p profiles%rowtype;
  v_email text;
  v_stats jsonb;
  v_super boolean := is_platform_super_admin();
begin
  if not is_admin() then
    raise exception 'Only admins can view customers.';
  end if;
  select * into v_p from profiles where id = p_id and role = 'customer' and (tenant_id = current_tenant_id() or is_super_admin());
  if not found then
    return null;
  end if;
  select email into v_email from auth.users where id = p_id;
  select jsonb_build_object(
    'orders', count(*) filter (where status <> 'cancelled'),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'spent', coalesce(sum(total) filter (where status = 'delivered'), 0),
    'last_order_at', max(created_at)
  ) into v_stats from orders where user_id = p_id;
  insert into admin_audit_log (actor_id, action, target_type, target_id) values (auth.uid(), 'customer.view', 'customer', p_id);
  return jsonb_build_object(
    'id', v_p.id,
    'name', v_p.full_name,
    'joined_at', v_p.created_at,
    'phone_masked', case when v_p.phone is null or v_p.phone = '' then null else left(v_p.phone, 4) || repeat('•', greatest(char_length(v_p.phone) - 7, 3)) || right(v_p.phone, 3) end,
    'email_masked', case when v_email is null then null else left(v_email, 1) || '•••' || substring(v_email from position('@' in v_email)) end,
    'blocked_at', v_p.blocked_at,
    'blocked_reason', v_p.blocked_reason,
    'can_reveal', v_super,
    'stats', v_stats,
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) - 'lat' - 'lng' - 'user_id' order by a.is_default desc, a.created_at desc) from addresses a where a.user_id = p_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'order_number', o.order_number, 'status', o.status, 'total', o.total, 'currency', o.currency, 'created_at', o.created_at) order by o.created_at desc) from (select * from orders where user_id = p_id order by created_at desc limit 50) o), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'author', coalesce(ap.full_name, 'Admin'), 'created_at', n.created_at) order by n.created_at desc) from customer_notes n left join profiles ap on ap.id = n.author_id where n.customer_id = p_id), '[]'::jsonb),
    'access_log', case when v_super then coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'actor', coalesce(lp.full_name, 'Admin'), 'created_at', l.created_at) order by l.created_at desc) from (select * from admin_audit_log where target_id = p_id order by created_at desc limit 25) l left join profiles lp on lp.id = l.actor_id), '[]'::jsonb) else null end
  );
end;
$$;
grant execute on function admin_customer_detail(uuid) to authenticated;

create or replace function admin_reveal_customer_contact(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_email text;
begin
  if not is_platform_super_admin() then
    raise exception 'Only the platform super admin can reveal customer contact details.';
  end if;
  select p.phone, u.email into v_phone, v_email from profiles p left join auth.users u on u.id = p.id where p.id = p_id and p.role = 'customer';
  if not found then
    raise exception 'Customer not found.';
  end if;
  insert into admin_audit_log (actor_id, action, target_type, target_id) values (auth.uid(), 'customer.reveal_contact', 'customer', p_id);
  return jsonb_build_object('phone', v_phone, 'email', v_email);
end;
$$;
grant execute on function admin_reveal_customer_contact(uuid) to authenticated;

create or replace function admin_set_customer_blocked(p_id uuid, p_blocked boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can block customers.';
  end if;
  if p_blocked and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please give a reason.';
  end if;
  update profiles
    set blocked_at = case when p_blocked then now() else null end,
        blocked_reason = case when p_blocked then btrim(p_reason) else null end,
        blocked_by = case when p_blocked then auth.uid() else null end
    where id = p_id and role = 'customer' and (tenant_id = current_tenant_id() or is_super_admin());
  if not found then
    raise exception 'Customer not found.';
  end if;
  insert into admin_audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), case when p_blocked then 'customer.block' else 'customer.unblock' end, 'customer', p_id, jsonb_build_object('reason', p_reason));
end;
$$;
grant execute on function admin_set_customer_blocked(uuid, boolean, text) to authenticated;

create or replace function admin_add_customer_note(p_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can add notes.';
  end if;
  if not exists (select 1 from profiles where id = p_id and role = 'customer' and (tenant_id = current_tenant_id() or is_super_admin())) then
    raise exception 'Customer not found.';
  end if;
  insert into customer_notes (customer_id, author_id, body) values (p_id, auth.uid(), btrim(p_body));
  insert into admin_audit_log (actor_id, action, target_type, target_id) values (auth.uid(), 'customer.note', 'customer', p_id);
end;
$$;
grant execute on function admin_add_customer_note(uuid, text) to authenticated;

create or replace function block_orders_for_blocked_customers()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.user_id and blocked_at is not null) then
    raise exception 'This account cannot place orders right now. Please contact support.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_block_orders_for_blocked_customers on orders;
create trigger trg_block_orders_for_blocked_customers before insert on orders for each row execute function block_orders_for_blocked_customers();
