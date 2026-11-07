-- =====================================================================================================
-- Migration: Google Auth driver profile fields, safe league discovery, and password-hashed league join
-- Preserves all existing tables, triggers, and RLS from 20261107000000_schema.sql
-- =====================================================================================================

create extension if not exists pgcrypto;

-- 1. Driver profile metadata columns on `drivers` (weight, bio, avatar/helmet)
alter table public.drivers add column if not exists first_name text not null default '';
alter table public.drivers add column if not exists surname text not null default '';
alter table public.drivers add column if not exists weight_kg numeric(5, 2);
alter table public.drivers add column if not exists bio text not null default '';
alter table public.drivers add column if not exists avatar_type text not null default 'helmet';
alter table public.drivers add column if not exists helmet_id text not null default 'neon-viper';
alter table public.drivers add column if not exists avatar_url text;

-- 2. League discovery & private password hash columns on `leagues`
alter table public.leagues add column if not exists country text not null default 'LATVIA';
alter table public.leagues add column if not exists is_private boolean not null default false;
alter table public.leagues add column if not exists password_hash text;

-- Drop legacy unused plaintext columns if they exist from earlier ad-hoc SQL editor test
alter table public.leagues drop column if exists password;
alter table public.leagues drop column if exists created_by_user_id;
alter table public.leagues drop column if exists member_roles;

-- Remove old root-level supabase_setup.sql policies if any remain
drop policy if exists "Allow public select on leagues" on public.leagues;
drop policy if exists "Allow public insert on leagues" on public.leagues;
drop policy if exists "Allow public update on leagues" on public.leagues;
drop policy if exists "Allow public delete on leagues" on public.leagues;

-- 3. Ensure every authenticated user (Google or Email) has a row in `drivers`
create or replace function public.fn_ensure_current_driver(
  p_display_name text default null,
  p_preferred_handle text default null
) returns public.drivers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_driver public.drivers;
  v_base_handle text;
  v_candidate text;
  v_suffix int := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_driver from public.drivers where user_id = v_uid;
  if found then
    return v_driver;
  end if;

  -- Build a valid handle matching check (handle ~ '^@[a-z0-9_-]{2,40}$')
  v_base_handle := lower(regexp_replace(coalesce(nullif(trim(p_preferred_handle), ''), nullif(trim(p_display_name), ''), 'driver'), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_base_handle := trim(both '-' from v_base_handle);
  if length(v_base_handle) < 2 then
    v_base_handle := 'driver-' || substr(v_uid::text, 1, 6);
  end if;
  v_base_handle := substr(v_base_handle, 1, 32);

  v_candidate := '@' || v_base_handle;
  while exists (select 1 from public.drivers where handle = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := '@' || v_base_handle || '-' || v_suffix::text;
  end loop;

  insert into public.drivers (user_id, display_name, handle)
  values (
    v_uid,
    coalesce(nullif(trim(p_display_name), ''), upper(v_base_handle)),
    v_candidate
  )
  returning * into v_driver;

  return v_driver;
end;
$$;

-- 4. Create a league (hashes password server-side if private; trg_league_owner adds creator to league_members as 'owner')
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
  my_role public.league_role,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_slug text;
  v_base_slug text;
  v_league public.leagues;
  v_hash text := null;
begin
  v_driver := public.fn_ensure_current_driver();

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'League name is required';
  end if;

  if p_is_private then
    if trim(coalesce(p_password, '')) = '' then
      raise exception 'Password is required for a private league';
    end if;
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  end if;

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'league';
  end if;
  v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.leagues (name, slug, country, is_private, password_hash, created_by)
  values (
    upper(trim(p_name)),
    v_slug,
    upper(trim(coalesce(nullif(p_country, ''), 'LATVIA'))),
    coalesce(p_is_private, false),
    v_hash,
    v_driver.id
  )
  returning * into v_league;

  -- Ensure owner membership exists in league_members
  insert into public.league_members (league_id, driver_id, role)
  values (v_league.id, v_driver.id, 'owner')
  on conflict (league_id, driver_id) do update set role = 'owner';

  return query
  select
    v_league.id,
    v_league.name,
    v_league.slug,
    v_league.country,
    v_league.is_private,
    'owner'::public.league_role as my_role,
    v_league.created_at;
end;
$$;

-- 5. List all leagues for discovery & My Leagues (never exposes password_hash)
create or replace function public.fn_list_leagues()
returns table (
  id uuid,
  name text,
  slug text,
  country text,
  is_private boolean,
  is_member boolean,
  my_role public.league_role,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    l.id,
    l.name,
    l.slug,
    l.country,
    l.is_private,
    (m.driver_id is not null) as is_member,
    m.role as my_role,
    l.created_at
  from public.leagues l
  left join public.league_members m
    on m.league_id = l.id and m.driver_id = public.auth_driver_id()
  order by l.created_at desc;
$$;

-- 6. Join a league (verifies hashed password if private, then adds row to league_members)
create or replace function public.fn_join_league(
  p_league_id uuid,
  p_password text default null
) returns public.league_role
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_league public.leagues;
  v_existing_role public.league_role;
begin
  v_driver := public.fn_ensure_current_driver();

  select * into v_league from public.leagues where id = p_league_id;
  if not found then
    raise exception 'League not found';
  end if;

  select role into v_existing_role
  from public.league_members
  where league_id = p_league_id and driver_id = v_driver.id;

  if found then
    return v_existing_role;
  end if;

  if v_league.is_private then
    if v_league.password_hash is not null and
       v_league.password_hash <> extensions.crypt(coalesce(p_password, ''), v_league.password_hash) then
      raise exception 'Invalid league password';
    end if;
  end if;

  insert into public.league_members (league_id, driver_id, role)
  values (p_league_id, v_driver.id, 'racer')
  on conflict (league_id, driver_id) do nothing;

  return 'racer'::public.league_role;
end;
$$;

notify pgrst, 'reload schema';
