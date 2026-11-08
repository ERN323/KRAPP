-- =====================================================================================================
-- Migration: MANAGE RACERS Actions
-- 1. Enhanced `fn_list_league_members` (includes current team, tags `#debitant` / `#heavyweight`, and penalties count)
-- 2. `fn_assign_racer_to_team` (assigns or unassigns a single racer to a team + notification)
-- 3. `fn_remove_racer_from_league` (removes racer from league_members & team_roster + notification)
-- 4. `fn_toggle_driver_tag` (toggles `#debitant` or `#heavyweight` in `tags` + `driver_tags` for current season)
-- 5. `fn_list_league_events` & `fn_assign_driver_penalty` (reads `events` and inserts `TIME` or `DSQ` into `penalties`)
-- =====================================================================================================

-- 1. Drop and recreate `fn_list_league_members` with team & tag metadata
drop function if exists public.fn_list_league_members(uuid);
create or replace function public.fn_list_league_members(p_league_id uuid)
returns table (
  driver_id uuid,
  display_name text,
  first_name text,
  surname text,
  handle text,
  driver_number text,
  app_role text,
  team_id uuid,
  team_name text,
  team_color_hex text,
  tags text[],
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
    t.id as team_id,
    t.name as team_name,
    t.color_hex as team_color_hex,
    coalesce(
      (
        select array_agg(tg.name order by tg.name)
        from public.driver_tags dt
        join public.tags tg on tg.id = dt.tag_id
        where dt.driver_id = d.id and tg.league_id = p_league_id
      ),
      '{}'::text[]
    ) as tags,
    m.joined_at
  from public.league_members m
  join public.drivers d on d.id = m.driver_id
  left join lateral (
    select tm.id, tm.name, tm.color_hex
    from public.team_roster tr
    join public.teams tm on tm.id = tr.team_id
    where tr.driver_id = d.id and tm.league_id = p_league_id
    limit 1
  ) t on true
  where m.league_id = p_league_id
  order by m.joined_at asc;
$$;

-- 2. Assign a single racer to a team (or pass p_team_id = null to remove from team)
create or replace function public.fn_assign_racer_to_team(
  p_league_id uuid,
  p_driver_id uuid,
  p_team_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_season_id uuid;
  v_team public.teams;
  v_league_name text;
begin
  v_actor := public.fn_ensure_current_driver();

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN', 'TEAM CAPTAIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins or Team Captains can assign racers to a team';
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);
  select name into v_league_name from public.leagues where id = p_league_id;

  -- Remove any existing team assignment for this driver in this league
  delete from public.team_roster
  where driver_id = p_driver_id
    and team_id in (select id from public.teams where league_id = p_league_id);

  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id and league_id = p_league_id;
    if not found then
      raise exception 'Team not found in this league';
    end if;

    insert into public.team_roster (team_id, season_id, driver_id)
    values (v_team.id, v_team.season_id, p_driver_id)
    on conflict (team_id, driver_id) do nothing;

    insert into public.notifications (
      recipient_driver_id,
      actor_driver_id,
      league_id,
      kind,
      title,
      body
    ) values (
      p_driver_id,
      v_actor.id,
      p_league_id,
      'TEAM_ADDED',
      coalesce(v_league_name, 'LEAGUE') || ' — Assigned to Team ' || v_team.name,
      'You have been assigned to team ' || v_team.name || ' in ' || coalesce(v_league_name, 'the league') || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
    );
  end if;
end;
$$;

-- 3. Remove a racer from a league
create or replace function public.fn_remove_racer_from_league(
  p_league_id uuid,
  p_target_driver_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_league_name text;
begin
  v_actor := public.fn_ensure_current_driver();

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can remove a racer from the league';
  end if;

  select name into v_league_name from public.leagues where id = p_league_id;

  -- Remove from any team in this league
  delete from public.team_roster
  where driver_id = p_target_driver_id
    and team_id in (select id from public.teams where league_id = p_league_id);

  -- Remove from league_members
  delete from public.league_members
  where league_id = p_league_id and driver_id = p_target_driver_id;

  -- Notify the removed user
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
    'LEAGUE_REMOVED',
    coalesce(v_league_name, 'LEAGUE') || ' — Removed from League',
    'You have been removed from ' || coalesce(v_league_name, 'the league') || ' by ' || coalesce(nullif(trim(v_actor.display_name), ''), v_actor.handle) || '.'
  );
end;
$$;

-- 4. Toggle a driver tag (`#debitant` or `#heavyweight`) for the current season
create or replace function public.fn_toggle_driver_tag(
  p_league_id uuid,
  p_target_driver_id uuid,
  p_tag_name text
) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_season_id uuid;
  v_tag_id uuid;
  v_clean_tag text := lower(trim(coalesce(p_tag_name, '')));
  v_league_name text;
  v_was_assigned boolean := false;
  v_updated_tags text[];
begin
  v_actor := public.fn_ensure_current_driver();

  if not (v_clean_tag like '#%') then
    v_clean_tag := '#' || v_clean_tag;
  end if;

  if v_clean_tag not in ('#debitant', '#heavyweight') then
    raise exception 'Unsupported tag: %. Allowed tags are #debitant and #heavyweight', v_clean_tag;
  end if;

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can assign tags';
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);

  -- Ensure tag exists in `public.tags` for this league
  insert into public.tags (league_id, name, colour)
  values (
    p_league_id,
    v_clean_tag,
    case when v_clean_tag = '#debitant' then '#38BDF8' else '#FF6B00' end
  )
  on conflict (league_id, name) do update set name = excluded.name
  returning id into v_tag_id;

  -- Check if driver already has this tag in this season
  if exists (
    select 1 from public.driver_tags
    where driver_id = p_target_driver_id and tag_id = v_tag_id and season_id = v_season_id
  ) then
    delete from public.driver_tags
    where driver_id = p_target_driver_id and tag_id = v_tag_id and season_id = v_season_id;
    v_was_assigned := false;
  else
    insert into public.driver_tags (driver_id, tag_id, season_id)
    values (p_target_driver_id, v_tag_id, v_season_id)
    on conflict do nothing;
    v_was_assigned := true;
  end if;

  select name into v_league_name from public.leagues where id = p_league_id;

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
    'TAG_UPDATED',
    coalesce(v_league_name, 'LEAGUE') || ' — Tag ' || upper(v_clean_tag),
    case
      when v_was_assigned then 'Tag ' || upper(v_clean_tag) || ' was assigned to you in ' || coalesce(v_league_name, 'the league') || '.'
      else 'Tag ' || upper(v_clean_tag) || ' was removed from your profile in ' || coalesce(v_league_name, 'the league') || '.'
    end
  );

  select coalesce(array_agg(tg.name order by tg.name), '{}'::text[])
  into v_updated_tags
  from public.driver_tags dt
  join public.tags tg on tg.id = dt.tag_id
  where dt.driver_id = p_target_driver_id and tg.league_id = p_league_id;

  return v_updated_tags;
end;
$$;

-- 5. List scheduled races (`events`) in a league + driver's existing penalties
create or replace function public.fn_list_league_events(p_league_id uuid)
returns table (
  id uuid,
  name text,
  event_date date,
  round_no int
)
language sql stable security definer set search_path = public as $$
  select
    e.id,
    e.name,
    e.event_date,
    e.round_no
  from public.events e
  where e.league_id = p_league_id
  order by e.event_date desc, e.round_no desc;
$$;

-- 6. Assign a penalty (`TIME` in seconds or `DSQ` disqualification) to a racer for a race (`event`)
--    If p_event_id is null, automatically creates/uses an event for p_fallback_date + p_fallback_name
create or replace function public.fn_assign_driver_penalty(
  p_league_id uuid,
  p_target_driver_id uuid,
  p_event_id uuid default null,
  p_kind text default 'TIME',
  p_seconds numeric default 0,
  p_reason text default '',
  p_fallback_date date default current_date,
  p_fallback_name text default 'Race Event'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_season_id uuid;
  v_event_id uuid := p_event_id;
  v_event_name text;
  v_event_date date;
  v_session_id uuid := null;
  v_next_round int;
  v_penalty_id uuid;
  v_league_name text;
  v_upper_kind text := upper(trim(coalesce(p_kind, 'TIME')));
begin
  v_actor := public.fn_ensure_current_driver();

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = p_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can assign penalties';
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);

  -- Ensure we have a valid event_id
  if v_event_id is null then
    select coalesce(max(round_no), 0) + 1 into v_next_round
    from public.events
    where season_id = v_season_id;

    insert into public.events (league_id, season_id, name, event_date, round_no)
    values (
      p_league_id,
      v_season_id,
      coalesce(nullif(trim(p_fallback_name), ''), 'Round ' || v_next_round::text),
      coalesce(p_fallback_date, current_date),
      v_next_round
    )
    returning id, name, event_date into v_event_id, v_event_name, v_event_date;
  else
    select name, event_date into v_event_name, v_event_date
    from public.events
    where id = v_event_id and league_id = p_league_id;

    if not found then
      raise exception 'Selected race event not found in this league';
    end if;
  end if;

  if v_upper_kind = 'TIME' then
    if coalesce(p_seconds, 0) <= 0 then
      raise exception 'Time penalty seconds must be greater than 0';
    end if;

    -- Ensure a FINAL session exists on this event so `penalties` check constraint is satisfied
    select id into v_session_id
    from public.sessions
    where event_id = v_event_id and kind = 'FINAL'
    order by final_letter asc
    limit 1;

    if not found then
      insert into public.sessions (event_id, kind, final_letter)
      values (v_event_id, 'FINAL', 'A')
      returning id into v_session_id;
    end if;

    insert into public.penalties (
      event_id,
      session_id,
      driver_id,
      kind,
      seconds,
      reason,
      created_by
    ) values (
      v_event_id,
      v_session_id,
      p_target_driver_id,
      'TIME',
      p_seconds,
      coalesce(trim(p_reason), ''),
      v_actor.id
    )
    returning id into v_penalty_id;
  elsif v_upper_kind = 'DSQ' then
    insert into public.penalties (
      event_id,
      session_id,
      driver_id,
      kind,
      seconds,
      reason,
      created_by
    ) values (
      v_event_id,
      null,
      p_target_driver_id,
      'DSQ',
      0,
      coalesce(nullif(trim(p_reason), ''), 'Disqualification (cannot participate in next race)'),
      v_actor.id
    )
    returning id into v_penalty_id;
  else
    raise exception 'Invalid penalty kind: %. Must be TIME or DSQ', v_upper_kind;
  end if;

  select name into v_league_name from public.leagues where id = p_league_id;

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
    'PENALTY_ASSIGNED',
    coalesce(v_league_name, 'LEAGUE') || ' — Penalty Assigned (' || to_char(v_event_date, 'DD.MM.YYYY') || ')',
    case
      when v_upper_kind = 'TIME' then
        'You received a +' || trim(to_char(p_seconds, 'FM999990.##')) || 's time penalty for ' || coalesce(v_event_name, 'Race') || ' (' || to_char(v_event_date, 'DD.MM.YYYY') || ').'
      else
        'You received a Disqualification (DSQ — cannot participate in the next race) for ' || coalesce(v_event_name, 'Race') || ' (' || to_char(v_event_date, 'DD.MM.YYYY') || ').'
    end
  );

  return v_penalty_id;
end;
$$;

notify pgrst, 'reload schema';
