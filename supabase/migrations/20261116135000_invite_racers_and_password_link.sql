-- =====================================================================================================
-- Migration: Invite Racers (QR Code & Shareable Invite Link with Password for Private Leagues)
-- Compatible with 20261107000000_schema.sql and 20261107180000_roles_and_notifications.sql
-- =====================================================================================================

-- 1. Store shareable `invite_password` on `public.leagues` for private leagues (never exposed in public list)
alter table public.leagues add column if not exists invite_password text;

-- Backfill existing private leagues that don't have `invite_password` yet with a 6-character passkey
update public.leagues
set invite_password = upper(substr(md5(id::text), 1, 6))
where is_private = true and coalesce(trim(invite_password), '') = '';

-- 2. Update `fn_create_league` to store `invite_password` when creating a private league
create or replace function public.fn_create_league(
  p_name text,
  p_country text,
  p_is_private boolean default false,
  p_password text default null
) returns table (
  id uuid,
  name text,
  slug text,
  country text,
  is_private boolean,
  my_role text,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_slug text;
  v_base_slug text;
  v_league public.leagues;
  v_hash text := null;
  v_clean_pwd text := null;
begin
  v_driver := public.fn_ensure_current_driver();

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'League name is required';
  end if;

  if p_is_private then
    v_clean_pwd := trim(coalesce(p_password, ''));
    if v_clean_pwd = '' then
      raise exception 'Password is required for a private league';
    end if;
    v_hash := extensions.crypt(v_clean_pwd, extensions.gen_salt('bf'));
  end if;

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'league';
  end if;
  v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.leagues (name, slug, country, is_private, password_hash, invite_password, created_by)
  values (
    upper(trim(p_name)),
    v_slug,
    upper(trim(coalesce(nullif(p_country, ''), 'LATVIA'))),
    coalesce(p_is_private, false),
    v_hash,
    v_clean_pwd,
    v_driver.id
  )
  returning * into v_league;

  insert into public.league_members (league_id, driver_id, role, app_role)
  values (v_league.id, v_driver.id, 'owner', 'ADMIN')
  on conflict (league_id, driver_id) do update set role = 'owner', app_role = 'ADMIN';

  return query
  select
    v_league.id,
    v_league.name,
    v_league.slug,
    v_league.country,
    v_league.is_private,
    'ADMIN'::text as my_role,
    v_league.created_at;
end;
$$;

-- 3. Update `fn_join_league` so private leagues accept either the original hashed password OR `invite_password`
create or replace function public.fn_join_league(
  p_league_id uuid,
  p_password text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_league public.leagues;
  v_existing_app_role text;
  v_input_pwd text := trim(coalesce(p_password, ''));
  v_hash_ok boolean := false;
  v_invite_ok boolean := false;
begin
  v_driver := public.fn_ensure_current_driver();

  select * into v_league from public.leagues where id = p_league_id;
  if not found then
    raise exception 'League not found';
  end if;

  select app_role into v_existing_app_role
  from public.league_members
  where league_id = p_league_id and driver_id = v_driver.id;

  if found then
    return v_existing_app_role;
  end if;

  if v_league.is_private then
    if v_league.password_hash is not null then
      v_hash_ok := (v_league.password_hash = extensions.crypt(v_input_pwd, v_league.password_hash));
    end if;
    if coalesce(trim(v_league.invite_password), '') <> '' then
      v_invite_ok := (trim(v_league.invite_password) = v_input_pwd);
    end if;

    if not v_hash_ok and not v_invite_ok then
      raise exception 'Invalid league password';
    end if;
  end if;

  insert into public.league_members (league_id, driver_id, role, app_role)
  values (p_league_id, v_driver.id, 'racer', 'RACER')
  on conflict (league_id, driver_id) do nothing;

  return 'RACER';
end;
$$;

-- 4. Retrieve invite details (`is_private` and `invite_password`) for league members/captains/admins
create or replace function public.fn_get_league_invite_info(
  p_league_id uuid
) returns table (
  league_id uuid,
  league_name text,
  is_private boolean,
  invite_password text
)
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_league public.leagues;
begin
  v_actor := public.fn_ensure_current_driver();

  if not exists (
    select 1 from public.league_members m
    where m.league_id = p_league_id and m.driver_id = v_actor.id
  ) then
    raise exception 'Only members of this league can view invite details';
  end if;

  select * into v_league from public.leagues where id = p_league_id;
  if not found then
    raise exception 'League not found';
  end if;

  if v_league.is_private and coalesce(trim(v_league.invite_password), '') = '' then
    update public.leagues
    set invite_password = upper(substr(md5(id::text), 1, 6))
    where id = p_league_id
    returning * into v_league;
  end if;

  return query
  select
    v_league.id as league_id,
    v_league.name as league_name,
    v_league.is_private,
    case when v_league.is_private then v_league.invite_password else null end as invite_password;
end;
$$;

notify pgrst, 'reload schema';
