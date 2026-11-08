-- =====================================================================================================
-- Migration: Delete Team RPC (with permission check & member notifications)
-- =====================================================================================================

create or replace function public.fn_delete_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_team public.teams;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_league_name text;
  v_roster_driver_ids uuid[];
  v_driver_id uuid;
begin
  v_actor := public.fn_ensure_current_driver();

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'Team not found';
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
    raise exception 'Only League Admins or Team Captains can delete a team';
  end if;

  select name into v_league_name from public.leagues where id = v_team.league_id;

  select coalesce(array_agg(driver_id), '{}')
  into v_roster_driver_ids
  from public.team_roster
  where team_id = p_team_id;

  -- Delete team (team_roster rows cascade automatically)
  delete from public.teams where id = p_team_id;

  -- Notify members that the team was deleted
  foreach v_driver_id in array v_roster_driver_ids loop
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
      'TEAM_DELETED',
      coalesce(v_league_name, 'LEAGUE') || ' — Team ' || v_team.name || ' Deleted',
      'Team ' || v_team.name || ' in ' || coalesce(v_league_name, 'the league') || ' was deleted by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
