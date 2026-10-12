-- A mobile number saved on a profile must have the shape of a real mobile number for its country.
-- Mirrors validatePhone() in src/lib/countries.ts (the forms check it first; this is the backstop for anything
-- that talks to the database directly, such as a sign-up call made outside the page).
-- Only checked when the number is added or changed, so older rows that do not match are left alone and the
-- people who own them can still save other changes to their profile. Empty / null numbers are allowed.
-- Safe to run more than once.

create or replace function is_valid_mobile(p text) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  rules text[][] := array[
    ['+91',  '^\+91[6-9]\d{9}$'],
    ['+966', '^\+9665\d{8}$'],
    ['+971', '^\+9715\d{8}$'],
    ['+965', '^\+965[569]\d{7}$'],
    ['+974', '^\+974[3567]\d{7}$'],
    ['+973', '^\+973[36]\d{7}$'],
    ['+968', '^\+968[79]\d{7}$'],
    ['+20',  '^\+201\d{9}$'],
    ['+92',  '^\+923\d{9}$'],
    ['+880', '^\+8801\d{9}$'],
    ['+94',  '^\+947\d{8}$'],
    ['+977', '^\+9779\d{9}$'],
    ['+63',  '^\+639\d{9}$'],
    ['+44',  '^\+447\d{9}$'],
    ['+1',   '^\+1[2-9]\d{9}$']
  ];
  i int;
begin
  if p is null or p = '' then return true; end if;
  if p !~ '^\+\d{8,15}$' then return false; end if;
  for i in 1 .. array_length(rules, 1) loop
    if left(p, length(rules[i][1])) = rules[i][1] and p !~ rules[i][2] then
      return false;
    end if;
  end loop;
  return true;
end $$;

create or replace function profiles_check_phone() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.phone is not null and new.phone <> '' and (tg_op = 'INSERT' or new.phone is distinct from old.phone) then
    if not is_valid_mobile(new.phone) then
      raise exception 'Enter a valid mobile number for its country.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_check_phone on profiles;
create trigger profiles_check_phone before insert or update of phone on profiles
  for each row execute function profiles_check_phone();
