-- =====================================================================================================
-- Migration: Assign Roles (ADMIN, CO-ADMIN, TEAM CAPTAIN, RACER, RESERVIST), Driver Number, and Notifications
-- Compatible with 20261107000000_schema.sql (keeps `league_members.role` enum untouched for existing RLS)
-- =====================================================================================================

-- 1. Driver Racing Number on `drivers` (e.g., "ERNESTS ADLERS - 33")
alter table public.drivers add column if not exists driver_number text not null default '';

-- 2. Granular App Role on `league_members` ('ADMIN', 'CO-ADMIN', 'TEAM CAPTAIN', 'RACER', 'RESERVIST')
alter table public.league_members add column if not exists app_role text not null default 'RACER';

-- Backfill existing owners to 'ADMIN'
update public.league_members set app_role = 'ADMIN' where role = 'owner' and app_role = 'RACER';

-- 3. Notifications table (for role changes, team invites, etc.)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_driver_id uuid not null references public.drivers (id) on delete cascade,
  actor_driver_id uuid references public.drivers (id) on delete set null,
  league_id uuid references public.leagues (id) on delete cascade,
  kind text not null default 'ROLE_CHANGE',
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_driver_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select using (recipient_driver_id = public.auth_driver_id());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (recipient_driver_id = public.auth_driver_id());

-- 4. Update fn_create_league so creator also gets app_role = 'ADMIN'
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

-- 5. Update fn_list_leagues to return app_role
drop function if exists public.fn_list_leagues();
create or replace function public.fn_list_leagues()
returns table (
  id uuid,
  name text,
  slug text,
  country text,
  is_private boolean,
  is_member boolean,
  my_role text,
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
    coalesce(m.app_role, case when m.role = 'owner' then 'ADMIN' when m.role = 'organiser' then 'CO-ADMIN' else 'RACER' end) as my_role,
    l.created_at
  from public.leagues l
  left join public.league_members m
    on m.league_id = l.id and m.driver_id = public.auth_driver_id()
  order by l.created_at desc;
$$;

-- 6. Update fn_join_league to set app_role = 'RACER'
drop function if exists public.fn_join_league(uuid, text);
create or replace function public.fn_join_league(
  p_league_id uuid,
  p_password text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_league public.leagues;
  v_existing_app_role text;
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
    if v_league.password_hash is not null and
       v_league.password_hash <> extensions.crypt(coalesce(p_password, ''), v_league.password_hash) then
      raise exception 'Invalid league password';
    end if;
  end if;

  insert into public.league_members (league_id, driver_id, role, app_role)
  values (p_league_id, v_driver.id, 'racer', 'RACER')
  on conflict (league_id, driver_id) do nothing;

  return 'RACER';
end;
$$;

-- 7. List all members of a league (for ASSIGN ROLES screen)
create or replace function public.fn_list_league_members(p_league_id uuid)
returns table (
  driver_id uuid,
  display_name text,
  first_name text,
  surname text,
  handle text,
  driver_number text,
  app_role text,
  joined_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    d.id as driver_id,
    d.display_name,
    d.first_name,
    d.surname,
    d.handle,
    d.driver_number,
    coalesce(m.app_role, case when m.role = 'owner' then 'ADMIN' else 'RACER' end) as app_role,
    m.joined_at
  from public.league_members m
  join public.drivers d on d.id = m.driver_id
  where m.league_id = p_league_id
  order by m.joined_at asc;
$$;

-- 8. Assign a role to a member in a league AND send them a notification
create or replace function public.fn_assign_league_role(
  p_league_id uuid,
  p_target_driver_id uuid,
  p_new_app_role text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_mapped_db_role public.league_role;
  v_league_name text;
  v_upper_role text := upper(trim(p_new_app_role));
begin
  v_actor := public.fn_ensure_current_driver();

  if v_upper_role not in ('ADMIN', 'CO-ADMIN', 'TEAM CAPTAIN', 'RACER', 'RESERVIST') then
    raise exception 'Invalid role: %', p_new_app_role;
  end if;

  -- Verify caller is ADMIN or CO-ADMIN (or owner/organiser) in this league
  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and v_caller_db_role not in ('owner', 'organiser')) then
    raise exception 'Only league Admins can assign roles';
  end if;

  v_mapped_db_role := case
    when v_upper_role = 'ADMIN' then 'owner'::public.league_role
    when v_upper_role = 'CO-ADMIN' then 'organiser'::public.league_role
    else 'racer'::public.league_role
  end;

  update public.league_members
  set
    app_role = v_upper_role,
    role = v_mapped_db_role
  where league_id = p_league_id and driver_id = p_target_driver_id;

  select name into v_league_name from public.leagues where id = p_league_id;

  -- Create notification for the target user
  insert into public.notifications (
    recipient_driver_id,
    actor_driver_id,
    league_id,
    kind,
    title,
    body
  ) values (
    p_target_driver_id,
    v_actor.id,
    p_league_id,
    'ROLE_CHANGE',
    coalesce(v_league_name, 'LEAGUE') || ' — Role Updated',
    'Your status in ' || coalesce(v_league_name, 'the league') || ' was changed to ' || v_upper_role || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
  );
end;
$$;

-- 9. List notifications for the logged-in user
create or replace function public.fn_get_my_notifications()
returns table (
  id uuid,
  league_id uuid,
  league_name text,
  kind text,
  title text,
  body text,
  is_read boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    n.id,
    n.league_id,
    l.name as league_name,
    n.kind,
    n.title,
    n.body,
    n.is_read,
    n.created_at
  from public.notifications n
  left join public.leagues l on l.id = n.league_id
  where n.recipient_driver_id = public.auth_driver_id()
  order by n.created_at desc
  limit 50;
$$;

-- 10. Mark notifications as read
create or replace function public.fn_mark_notifications_read()
returns void
language sql security definer set search_path = public as $$
  update public.notifications
  set is_read = true
  where recipient_driver_id = public.auth_driver_id() and is_read = false;
$$;

notify pgrst, 'reload schema';
