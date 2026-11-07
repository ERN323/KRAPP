-- =====================================================================================================
-- Migration: Create Team (Name, HEX Color, Cropped Logo, Team Roster) + Team Assignment Notifications
-- Compatible with 20261107000000_schema.sql (uses `teams`, `team_roster`, `seasons`, `points_schemes`, `licence_rules`)
-- =====================================================================================================

-- 1. Add Team styling & metadata columns to `teams`
alter table public.teams add column if not exists color_hex text not null default '#FF6B00';
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists created_by uuid references public.drivers (id) on delete set null;
alter table public.teams add column if not exists created_at timestamptz not null default now();

-- 2. Helper: Ensure a default season exists for a league so `teams` and `team_roster` (which require `season_id`) work seamlessly
create or replace function public.fn_ensure_default_season(p_league_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_season_id uuid;
  v_points_id uuid;
  v_licence_id uuid;
begin
  select id into v_season_id
  from public.seasons
  where league_id = p_league_id
  order by starts_on desc nulls last, name desc
  limit 1;

  if found then
    return v_season_id;
  end if;

  -- Ensure a default points_schemes row exists for this league
  select id into v_points_id from public.points_schemes where league_id = p_league_id limit 1;
  if not found then
    insert into public.points_schemes (league_id, name, final_points)
    values (p_league_id, 'Default Points', array[25, 18, 15, 12, 10, 8, 6, 4, 2, 1])
    returning id into v_points_id;
  end if;

  -- Ensure a default licence_rules row exists for this league
  select id into v_licence_id from public.licence_rules where league_id = p_league_id limit 1;
  if not found then
    insert into public.licence_rules (league_id)
    values (p_league_id)
    returning id into v_licence_id;
  end if;

  insert into public.seasons (league_id, name, starts_on, points_scheme_id, licence_rules_id)
  values (p_league_id, 'Season 1', current_date, v_points_id, v_licence_id)
  returning id into v_season_id;

  return v_season_id;
end;
$$;

-- 3. Create a Team, assign selected league members to `team_roster`, and send notifications to each assigned member
create or replace function public.fn_create_team(
  p_league_id uuid,
  p_name text,
  p_color_hex text default '#FF6B00',
  p_logo_url text default null,
  p_driver_ids uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_season_id uuid;
  v_team_id uuid;
  v_league_name text;
  v_driver_id uuid;
  v_clean_name text := upper(trim(coalesce(p_name, '')));
  v_clean_color text := coalesce(nullif(trim(p_color_hex), ''), '#FF6B00');
begin
  v_actor := public.fn_ensure_current_driver();

  if v_clean_name = '' then
    raise exception 'Team name is required';
  end if;

  -- Verify caller is ADMIN, CO-ADMIN, or TEAM CAPTAIN in this league
  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN', 'TEAM CAPTAIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins or Team Captains can create a team';
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);

  insert into public.teams (league_id, season_id, name, color_hex, logo_url, created_by)
  values (p_league_id, v_season_id, v_clean_name, v_clean_color, p_logo_url, v_actor.id)
  returning id into v_team_id;

  select name into v_league_name from public.leagues where id = p_league_id;

  -- Assign each selected racer to the team for this season and send them a notification
  if p_driver_ids is not null then
    foreach v_driver_id in array p_driver_ids loop
      -- Remove any previous team assignment in this season so unique(season_id, driver_id) is respected
      delete from public.team_roster
      where season_id = v_season_id and driver_id = v_driver_id;

      insert into public.team_roster (team_id, season_id, driver_id)
      values (v_team_id, v_season_id, v_driver_id)
      on conflict (team_id, driver_id) do nothing;

      insert into public.notifications (
        recipient_driver_id,
        actor_driver_id,
        league_id,
        kind,
        title,
        body
      ) values (
        v_driver_id,
        v_actor.id,
        p_league_id,
        'TEAM_ADDED',
        coalesce(v_league_name, 'LEAGUE') || ' — Added to Team ' || v_clean_name,
        'You have been assigned to team ' || v_clean_name || ' in ' || coalesce(v_league_name, 'the league') || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
      );
    end loop;
  end if;

  return v_team_id;
end;
$$;

-- 4. List teams in a league with their assigned roster
create or replace function public.fn_list_league_teams(p_league_id uuid)
returns table (
  id uuid,
  name text,
  color_hex text,
  logo_url text,
  member_count bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    t.name,
    t.color_hex,
    t.logo_url,
    count(r.driver_id) as member_count,
    t.created_at
  from public.teams t
  left join public.team_roster r on r.team_id = t.id
  where t.league_id = p_league_id
  group by t.id
  order by t.created_at desc;
$$;

notify pgrst, 'reload schema';
