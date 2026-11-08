-- =====================================================================================================
-- Migration: Schedule Race (Calendar Date, Time, Location, Title) + League Races View + Race RSVP (Pass / Participate)
-- Compatible with 20261107000000_schema.sql (`events`, `tracks`, `v_event_classification`)
-- =====================================================================================================

-- 1. Add time and location columns to `public.events`
alter table public.events add column if not exists event_time text not null default '19:00';
alter table public.events add column if not exists location text not null default '';

-- 2. Create `public.event_rsvps` table to track each league member's PASS / PARTICIPATE choice per race
create table if not exists public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  status text not null check (status in ('PARTICIPATE', 'PASS')),
  updated_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);

alter table public.event_rsvps enable row level security;

drop policy if exists event_rsvps_read on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps
  for select using (auth.uid() is not null);

drop policy if exists event_rsvps_write_own on public.event_rsvps;
create policy event_rsvps_write_own on public.event_rsvps
  for all using (driver_id = public.auth_driver_id())
  with check (driver_id = public.auth_driver_id());

-- 3. Schedule a new race (`fn_schedule_race`) and notify all league members
create or replace function public.fn_schedule_race(
  p_league_id uuid,
  p_name text,
  p_event_date date,
  p_event_time text default '19:00',
  p_location text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_season_id uuid;
  v_track_id uuid := null;
  v_next_round int;
  v_event_id uuid;
  v_clean_name text := upper(trim(coalesce(p_name, '')));
  v_clean_location text := upper(trim(coalesce(p_location, '')));
  v_clean_time text := coalesce(nullif(trim(p_event_time), ''), '19:00');
  v_league_name text;
  v_member_driver_id uuid;
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
    raise exception 'Only League Admins can schedule races';
  end if;

  if v_clean_name = '' and v_clean_location = '' then
    raise exception 'Please enter a race title or location';
  end if;

  if v_clean_name = '' then
    v_clean_name := v_clean_location;
  end if;

  if v_clean_location = '' then
    v_clean_location := v_clean_name;
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);

  -- Ensure track exists in `public.tracks`
  insert into public.tracks (name, layout)
  values (v_clean_location, '')
  on conflict (name, layout) do update set name = excluded.name
  returning id into v_track_id;

  select coalesce(max(round_no), 0) + 1 into v_next_round
  from public.events
  where season_id = v_season_id;

  insert into public.events (
    league_id,
    season_id,
    track_id,
    name,
    event_date,
    event_time,
    location,
    round_no
  ) values (
    p_league_id,
    v_season_id,
    v_track_id,
    v_clean_name,
    coalesce(p_event_date, current_date),
    v_clean_time,
    v_clean_location,
    v_next_round
  )
  returning id into v_event_id;

  select name into v_league_name from public.leagues where id = p_league_id;

  -- Notify all league members about the scheduled race
  for v_member_driver_id in
    select driver_id from public.league_members where league_id = p_league_id
  loop
    insert into public.notifications (
      recipient_driver_id,
      actor_driver_id,
      league_id,
      kind,
      title,
      body
    ) values (
      v_member_driver_id,
      v_actor.id,
      p_league_id,
      'RACE_SCHEDULED',
      coalesce(v_league_name, 'LEAGUE') || ' — New Race Scheduled: ' || v_clean_name,
      'Race "' || v_clean_name || '" at ' || v_clean_location || ' is scheduled for ' || to_char(coalesce(p_event_date, current_date), 'DD.MM.YYYY') || ' at ' || v_clean_time || '.'
    );
  end loop;

  return v_event_id;
end;
$$;

-- 4. List all races (`events`) in a league with Top 3 finishers and the current user's RSVP status
drop function if exists public.fn_list_league_events(uuid);
create or replace function public.fn_list_league_events(p_league_id uuid)
returns table (
  id uuid,
  name text,
  location text,
  event_date date,
  event_time text,
  round_no int,
  my_rsvp text,
  participating_count bigint,
  top3_names text[]
)
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
begin
  v_actor := public.fn_ensure_current_driver();

  return query
  select
    e.id,
    e.name,
    coalesce(nullif(e.location, ''), t.name, e.name) as location,
    e.event_date,
    coalesce(e.event_time, '19:00') as event_time,
    e.round_no,
    rsvp.status as my_rsvp,
    (
      select count(*) from public.event_rsvps er
      where er.event_id = e.id and er.status = 'PARTICIPATE'
    ) as participating_count,
    coalesce(
      (
        select array_agg(podium.driver_label order by podium.overall_pos asc)
        from (
          select
            c.overall_pos,
            coalesce(
              nullif(trim(d.first_name || ' ' || d.surname), ''),
              d.display_name,
              d.handle
            ) as driver_label
          from public.v_event_classification c
          join public.drivers d on d.id = c.driver_id
          where c.event_id = e.id and c.overall_pos <= 3
          order by c.overall_pos asc
          limit 3
        ) podium
      ),
      '{}'::text[]
    ) as top3_names
  from public.events e
  left join public.tracks t on t.id = e.track_id
  left join public.event_rsvps rsvp
    on rsvp.event_id = e.id and rsvp.driver_id = v_actor.id
  where e.league_id = p_league_id
  order by e.event_date desc, e.round_no desc;
end;
$$;

-- 5. Set the current user's RSVP (`PARTICIPATE` or `PASS`) for a race
create or replace function public.fn_set_race_rsvp(
  p_event_id uuid,
  p_status text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_clean_status text := upper(trim(coalesce(p_status, '')));
begin
  v_actor := public.fn_ensure_current_driver();

  if v_clean_status not in ('PARTICIPATE', 'PASS') then
    raise exception 'Invalid status: %. Must be PARTICIPATE or PASS', v_clean_status;
  end if;

  insert into public.event_rsvps (event_id, driver_id, status, updated_at)
  values (p_event_id, v_actor.id, v_clean_status, now())
  on conflict (event_id, driver_id)
  do update set status = excluded.status, updated_at = now();

  return v_clean_status;
end;
$$;

notify pgrst, 'reload schema';
