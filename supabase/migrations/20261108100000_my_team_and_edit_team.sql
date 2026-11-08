-- =====================================================================================================
-- Migration: My Team Inspection + Edit Team (Name, Color, Logo, Add/Kick Teammates + Notifications)
-- =====================================================================================================

-- 1. Fetch all teams in a league along with their full roster and whether the current user belongs to each team
create or replace function public.fn_get_league_teams_with_rosters(p_league_id uuid)
returns table (
  id uuid,
  name text,
  color_hex text,
  logo_url text,
  created_by uuid,
  is_my_team boolean,
  members jsonb,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
begin
  v_actor := public.fn_ensure_current_driver();

  return query
  select
    t.id,
    t.name,
    t.color_hex,
    t.logo_url,
    t.created_by,
    (
      exists (
        select 1 from public.team_roster tr
        where tr.team_id = t.id and tr.driver_id = v_actor.id
      )
      or t.created_by = v_actor.id
    ) as is_my_team,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'driver_id', d.id,
            'display_name', d.display_name,
            'first_name', coalesce(d.first_name, ''),
            'surname', coalesce(d.surname, ''),
            'handle', d.handle,
            'driver_number', coalesce(d.driver_number, ''),
            'app_role', coalesce(lm.app_role, 'RACER')
          )
          order by d.display_name asc
        )
        from public.team_roster tr
        join public.drivers d on d.id = tr.driver_id
        left join public.league_members lm
          on lm.league_id = t.league_id and lm.driver_id = d.id
        where tr.team_id = t.id
      ),
      '[]'::jsonb
    ) as members,
    t.created_at
  from public.teams t
  where t.league_id = p_league_id
  order by
    (
      exists (
        select 1 from public.team_roster tr
        where tr.team_id = t.id and tr.driver_id = v_actor.id
      )
      or t.created_by = v_actor.id
    ) desc,
    t.created_at desc;
end;
$$;

-- 2. Update an existing team (name, HEX color, logo, and roster additions/removals with notifications)
create or replace function public.fn_update_team(
  p_team_id uuid,
  p_name text,
  p_color_hex text default '#FF6B00',
  p_logo_url text default null,
  p_driver_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_team public.teams;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_league_name text;
  v_clean_name text := upper(trim(coalesce(p_name, '')));
  v_clean_color text := coalesce(nullif(trim(p_color_hex), ''), '#FF6B00');
  v_old_driver_ids uuid[];
  v_driver_id uuid;
begin
  v_actor := public.fn_ensure_current_driver();

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'Team not found';
  end if;

  if v_clean_name = '' then
    raise exception 'Team name is required';
  end if;

  -- Check permission: ADMIN, CO-ADMIN, TEAM CAPTAIN, or team creator
  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = v_team.league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN', 'TEAM CAPTAIN') and
    v_caller_db_role not in ('owner', 'organiser') and
    v_team.created_by is distinct from v_actor.id
  ) then
    raise exception 'Only League Admins or Team Captains can edit a team';
  end if;

  select name into v_league_name from public.leagues where id = v_team.league_id;

  -- Snapshot existing roster before update
  select coalesce(array_agg(driver_id), '{}')
  into v_old_driver_ids
  from public.team_roster
  where team_id = p_team_id;

  -- Update team metadata
  update public.teams
  set
    name = v_clean_name,
    color_hex = v_clean_color,
    logo_url = p_logo_url
  where id = p_team_id;

  -- 2a. Remove kicked drivers & notify them
  foreach v_driver_id in array v_old_driver_ids loop
    if not (v_driver_id = any(coalesce(p_driver_ids, '{}'))) then
      delete from public.team_roster
      where team_id = p_team_id and driver_id = v_driver_id;

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
        v_team.league_id,
        'TEAM_REMOVED',
        coalesce(v_league_name, 'LEAGUE') || ' — Removed from Team ' || v_clean_name,
        'You have been removed from team ' || v_clean_name || ' in ' || coalesce(v_league_name, 'the league') || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
      );
    end if;
  end loop;

  -- 2b. Add new drivers & notify them
  if p_driver_ids is not null then
    foreach v_driver_id in array p_driver_ids loop
      if not (v_driver_id = any(v_old_driver_ids)) then
        delete from public.team_roster
        where season_id = v_team.season_id and driver_id = v_driver_id;

        insert into public.team_roster (team_id, season_id, driver_id)
        values (p_team_id, v_team.season_id, v_driver_id)
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
          v_team.league_id,
          'TEAM_ADDED',
          coalesce(v_league_name, 'LEAGUE') || ' — Added to Team ' || v_clean_name,
          'You have been assigned to team ' || v_clean_name || ' in ' || coalesce(v_league_name, 'the league') || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
        );
      end if;
    end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';
