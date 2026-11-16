-- =====================================================================================================
-- Migration: Official Karting Tracks, Configurations (A..F), Addresses + Admin Edit & Delete Scheduled Race
-- Compatible with 20261107000000_schema.sql (`events`, `tracks`, `v_event_classification`)
-- =====================================================================================================

-- 1. Add track configuration, address, and slug columns to `public.events` and `public.tracks`
alter table public.tracks add column if not exists address text not null default '';
alter table public.tracks add column if not exists slug text not null default '';

alter table public.events add column if not exists event_time text not null default '19:00';
alter table public.events add column if not exists location text not null default '';
alter table public.events add column if not exists track_config text not null default 'A';
alter table public.events add column if not exists track_address text not null default '';
alter table public.events add column if not exists track_slug text not null default '';

-- 2. Seed the 7 official Karting Tracks and their configurations (A..F) into `public.tracks`
insert into public.tracks (name, layout, address, slug)
values
  ('KANDAVA KARTODROMS', 'A', 'Jelgavas iela 16, Kandava, Kandava pilsēta, Tukuma novads, LV-3120', 'kandava'),
  ('KANDAVA KARTODROMS', 'B', 'Jelgavas iela 16, Kandava, Kandava pilsēta, Tukuma novads, LV-3120', 'kandava'),
  ('Kartings.lv', 'A', 'Gustava Zemgala gat. 77-k-1, Vidzemes priekšpilsēta, Rīga, LV-1039', 'kartings-lv'),
  ('Kartings.lv', 'B', 'Gustava Zemgala gat. 77-k-1, Vidzemes priekšpilsēta, Rīga, LV-1039', 'kartings-lv'),
  ('Madonas kartinga trase', 'A', 'Gaujas iela 41, Madona, Madona pilsēta, Madonas novads, LV-4801', 'madona'),
  ('Madonas kartinga trase', 'B', 'Gaujas iela 41, Madona, Madona pilsēta, Madonas novads, LV-4801', 'madona'),
  ('Rullītis Jelgava', 'A', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('Rullītis Jelgava', 'B', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('Rullītis Jelgava', 'C', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('Rullītis Jelgava', 'D', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('Rullītis Jelgava', 'E', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('Rullītis Jelgava', 'F', 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008', 'rullitis-jelgava'),
  ('XL Rīga kartinga nams', 'A', 'Ūdens iela 23, Kurzemes rajons, Rīga, LV-1007', 'xl-riga'),
  ('XL Rīga kartinga nams', 'B', 'Ūdens iela 23, Kurzemes rajons, Rīga, LV-1007', 'xl-riga'),
  ('Baciunu kartodromas MANDE, Šauļi, LT', 'A', 'Bačiūnų g. 27A, Šiauliai, 76383 Šiaulių m. sav., Lithuania', 'baciunu-siauliai'),
  ('Baciunu kartodromas MANDE, Šauļi, LT', 'B', 'Bačiūnų g. 27A, Šiauliai, 76383 Šiaulių m. sav., Lithuania', 'baciunu-siauliai'),
  ('Serbentu kartodromas MANDE, Šauļi, LT', 'A', 'Serbentų g. 86, Šiauliai, 78136 Šiaulių m. sav., Lithuania', 'serbentu-siauliai'),
  ('Serbentu kartodromas MANDE, Šauļi, LT', 'B', 'Serbentų g. 86, Šiauliai, 78136 Šiaulių m. sav., Lithuania', 'serbentu-siauliai')
on conflict (name, layout) do update
set
  address = excluded.address,
  slug = excluded.slug;

-- 3. Schedule a new race (`fn_schedule_race`) with track, configuration, and address
drop function if exists public.fn_schedule_race(uuid, text, date, text, text);
create or replace function public.fn_schedule_race(
  p_league_id uuid,
  p_name text,
  p_event_date date,
  p_event_time text default '19:00',
  p_location text default '',
  p_track_config text default 'A',
  p_track_address text default '',
  p_track_slug text default ''
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
  v_clean_name text := trim(coalesce(p_name, ''));
  v_clean_location text := trim(coalesce(p_location, ''));
  v_clean_time text := coalesce(nullif(trim(p_event_time), ''), '19:00');
  v_clean_config text := upper(coalesce(nullif(trim(p_track_config), ''), 'A'));
  v_clean_address text := trim(coalesce(p_track_address, ''));
  v_clean_slug text := lower(trim(coalesce(p_track_slug, '')));
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
    raise exception 'Please select a track location or enter a race title';
  end if;

  if v_clean_name = '' then
    v_clean_name := v_clean_location;
  end if;

  if v_clean_location = '' then
    v_clean_location := v_clean_name;
  end if;

  v_season_id := public.fn_ensure_default_season(p_league_id);

  insert into public.tracks (name, layout, address, slug)
  values (v_clean_location, v_clean_config, v_clean_address, v_clean_slug)
  on conflict (name, layout) do update
  set
    address = coalesce(nullif(excluded.address, ''), public.tracks.address),
    slug = coalesce(nullif(excluded.slug, ''), public.tracks.slug)
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
    track_config,
    track_address,
    track_slug,
    round_no
  ) values (
    p_league_id,
    v_season_id,
    v_track_id,
    v_clean_name,
    coalesce(p_event_date, current_date),
    v_clean_time,
    v_clean_location,
    v_clean_config,
    v_clean_address,
    v_clean_slug,
    v_next_round
  )
  returning id into v_event_id;

  select name into v_league_name from public.leagues where id = p_league_id;

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
      'Race "' || v_clean_name || '" at ' || v_clean_location || ' (Config ' || v_clean_config || ') is scheduled for ' || to_char(coalesce(p_event_date, current_date), 'DD.MM.YYYY') || ' at ' || v_clean_time || '.'
    );
  end loop;

  return v_event_id;
end;
$$;

-- 4. Update an existing scheduled race (`fn_update_race`)
drop function if exists public.fn_update_race(uuid, text, date, text, text);
create or replace function public.fn_update_race(
  p_event_id uuid,
  p_name text,
  p_event_date date,
  p_event_time text default '19:00',
  p_location text default '',
  p_track_config text default 'A',
  p_track_address text default '',
  p_track_slug text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_league_id uuid;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_track_id uuid := null;
  v_clean_name text := trim(coalesce(p_name, ''));
  v_clean_location text := trim(coalesce(p_location, ''));
  v_clean_time text := coalesce(nullif(trim(p_event_time), ''), '19:00');
  v_clean_config text := upper(coalesce(nullif(trim(p_track_config), ''), 'A'));
  v_clean_address text := trim(coalesce(p_track_address, ''));
  v_clean_slug text := lower(trim(coalesce(p_track_slug, '')));
  v_league_name text;
  v_member_driver_id uuid;
begin
  v_actor := public.fn_ensure_current_driver();

  select e.league_id into v_league_id
  from public.events e
  where e.id = p_event_id;

  if v_league_id is null then
    raise exception 'Race event not found';
  end if;

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = v_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can edit scheduled races';
  end if;

  if v_clean_name = '' and v_clean_location = '' then
    raise exception 'Please select a track location or enter a race title';
  end if;

  if v_clean_name = '' then
    v_clean_name := v_clean_location;
  end if;

  if v_clean_location = '' then
    v_clean_location := v_clean_name;
  end if;

  insert into public.tracks (name, layout, address, slug)
  values (v_clean_location, v_clean_config, v_clean_address, v_clean_slug)
  on conflict (name, layout) do update
  set
    address = coalesce(nullif(excluded.address, ''), public.tracks.address),
    slug = coalesce(nullif(excluded.slug, ''), public.tracks.slug)
  returning id into v_track_id;

  update public.events
  set
    name = v_clean_name,
    location = v_clean_location,
    track_id = v_track_id,
    track_config = v_clean_config,
    track_address = v_clean_address,
    track_slug = v_clean_slug,
    event_date = coalesce(p_event_date, event_date),
    event_time = v_clean_time
  where id = p_event_id;

  select name into v_league_name from public.leagues where id = v_league_id;

  for v_member_driver_id in
    select driver_id from public.league_members where league_id = v_league_id
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
      v_league_id,
      'RACE_UPDATED',
      coalesce(v_league_name, 'LEAGUE') || ' — Race Updated: ' || v_clean_name,
      'Race "' || v_clean_name || '" at ' || v_clean_location || ' (Config ' || v_clean_config || ') is now scheduled for ' || to_char(coalesce(p_event_date, current_date), 'DD.MM.YYYY') || ' at ' || v_clean_time || '.'
    );
  end loop;
end;
$$;

-- 5. Delete / Cancel a scheduled race (`fn_delete_race`)
create or replace function public.fn_delete_race(
  p_event_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_league_id uuid;
  v_race_name text;
  v_race_date date;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_league_name text;
  v_member_driver_id uuid;
begin
  v_actor := public.fn_ensure_current_driver();

  select e.league_id, e.name, e.event_date
  into v_league_id, v_race_name, v_race_date
  from public.events e
  where e.id = p_event_id;

  if v_league_id is null then
    raise exception 'Race event not found';
  end if;

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = v_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can delete scheduled races';
  end if;

  select name into v_league_name from public.leagues where id = v_league_id;

  delete from public.events where id = p_event_id;

  for v_member_driver_id in
    select driver_id from public.league_members where league_id = v_league_id
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
      v_league_id,
      'RACE_CANCELLED',
      coalesce(v_league_name, 'LEAGUE') || ' — Race Cancelled: ' || coalesce(v_race_name, 'RACE'),
      'Scheduled race "' || coalesce(v_race_name, 'RACE') || '" (' || to_char(coalesce(v_race_date, current_date), 'DD.MM.YYYY') || ') has been cancelled by an Admin.'
    );
  end loop;
end;
$$;

-- 6. Update `fn_list_league_events` to include `track_config`, `track_address`, and `track_slug`
drop function if exists public.fn_list_league_events(uuid);
create or replace function public.fn_list_league_events(p_league_id uuid)
returns table (
  id uuid,
  name text,
  location text,
  track_config text,
  track_address text,
  track_slug text,
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
    coalesce(nullif(e.track_config, ''), nullif(t.layout, ''), 'A') as track_config,
    coalesce(nullif(e.track_address, ''), nullif(t.address, ''), '') as track_address,
    coalesce(nullif(e.track_slug, ''), nullif(t.slug, ''), '') as track_slug,
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

notify pgrst, 'reload schema';
