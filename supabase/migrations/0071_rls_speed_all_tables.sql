-- Speed fix for every row policy: calls like current_tenant_id(), is_admin(), is_super_admin() and auth.uid() take the same value for
-- every row of a query, but inside a policy Postgres re-runs them for EACH ROW. Wrapping them as (select fn()) makes Postgres run each
-- once per query. The rules and who can see what stay exactly the same; only the speed changes (the catalog count went from 3,266 ms
-- to 7 ms the same way). Safe to run again: already-wrapped calls are left as they are.
-- Run the whole file in the Supabase SQL editor.

do $$
declare
  p record;
  fns constant text := 'auth\.uid|is_admin|current_tenant_id|is_super_admin|my_staff_warehouse_id|is_rider|is_platform_owner|express_dispatch_on';
  new_using text;
  new_check text;
  changed int := 0;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    new_using := p.qual;
    new_check := p.with_check;
    if new_using is not null then
      new_using := regexp_replace(new_using, '\(\s*SELECT\s+((?:' || fns || ')\(\))\s+AS\s+\w+\s*\)', '\1', 'gi');
      new_using := regexp_replace(new_using, '(?<![a-z0-9_.])((?:' || fns || ')\(\))', '(select \1)', 'gi');
    end if;
    if new_check is not null then
      new_check := regexp_replace(new_check, '\(\s*SELECT\s+((?:' || fns || ')\(\))\s+AS\s+\w+\s*\)', '\1', 'gi');
      new_check := regexp_replace(new_check, '(?<![a-z0-9_.])((?:' || fns || ')\(\))', '(select \1)', 'gi');
    end if;
    if new_using is distinct from p.qual or new_check is distinct from p.with_check then
      execute format('alter policy %I on %I.%I%s%s', p.policyname, p.schemaname, p.tablename,
        case when new_using is not null then ' using (' || new_using || ')' else '' end,
        case when new_check is not null then ' with check (' || new_check || ')' else '' end);
      changed := changed + 1;
    end if;
  end loop;
  raise notice 'policies rewritten: %', changed;
end
$$;
