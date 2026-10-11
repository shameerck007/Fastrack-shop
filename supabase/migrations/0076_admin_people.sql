-- Users and roles for admins: every account type (customers, suppliers, riders, store staff and, for the platform super admin, admins) in one
-- list with counts, search and links to where each type is managed. Contact details come back masked, like the customer list.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

create or replace function admin_people(p_role text default 'all', p_q text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_super boolean := is_platform_super_admin();
  v_total int;
  v_items jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can view users.';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%';
  end if;
  select count(*) into v_total
  from profiles p
  left join auth.users u on u.id = p.id
  where (p.tenant_id = current_tenant_id() or is_super_admin())
    and (p.role::text not in ('admin', 'super_admin') or v_super)
    and (p_role = 'all' or p_role is null or p.role::text = p_role)
    and (v_q is null or p.full_name ilike v_like or p.phone ilike v_like or u.email ilike v_like);
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v_items
  from (
    select p.created_at,
      jsonb_build_object(
        'id', p.id,
        'name', p.full_name,
        'role', p.role::text,
        'phone_masked', case when p.phone is null or p.phone = '' then null else left(p.phone, 4) || repeat('•', greatest(char_length(p.phone) - 7, 3)) || right(p.phone, 3) end,
        'email_masked', case when u.email is null then null else left(u.email, 1) || '•••' || substring(u.email from position('@' in u.email)) end,
        'joined_at', p.created_at,
        'blocked', p.blocked_at is not null,
        'store_id', st.id, 'store_name', st.name, 'store_status', st.status::text,
        'warehouse_id', ws.warehouse_id, 'warehouse_name', wh.name
      ) as j
    from profiles p
    left join auth.users u on u.id = p.id
    left join stores st on st.owner_id = p.id
    left join warehouse_staff ws on ws.user_id = p.id
    left join warehouses wh on wh.id = ws.warehouse_id
    where (p.tenant_id = current_tenant_id() or is_super_admin())
      and (p.role::text not in ('admin', 'super_admin') or v_super)
      and (p_role = 'all' or p_role is null or p.role::text = p_role)
      and (v_q is null or p.full_name ilike v_like or p.phone ilike v_like or u.email ilike v_like)
    order by p.created_at desc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) x;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;
grant execute on function admin_people(text, text, int, int) to authenticated;

create or replace function admin_people_counts()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_super boolean := is_platform_super_admin();
begin
  if not is_admin() then
    raise exception 'Only admins can view users.';
  end if;
  return coalesce((
    select jsonb_object_agg(role, n)
    from (
      select p.role::text as role, count(*) as n
      from profiles p
      where (p.tenant_id = current_tenant_id() or is_super_admin())
        and (p.role::text not in ('admin', 'super_admin') or v_super)
      group by p.role
    ) c
  ), '{}'::jsonb);
end;
$$;
grant execute on function admin_people_counts() to authenticated;
