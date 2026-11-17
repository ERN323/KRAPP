-- =====================================================================================================
-- Migration: Automatic Qualifying & Race Final Upload (Auto-Matches & Sorts Results to Each Racer)
-- Compatible with 20261107000000_schema.sql (`sessions`, `uploads`, `session_results`, `event_entries`, `v_combined_quali`, `v_event_classification`)
-- =====================================================================================================

-- 1. Upload & Publish Qualifying (`QUALI`) or Race (`FINAL`) results atomically.
--    Automatically merges/upserts results per racer across multiple heat CSVs without needing manual heat/final selection!
create or replace function public.fn_upload_session_results(
  p_event_id uuid,
  p_kind text,                      -- 'QUALI' or 'FINAL'
  p_batch_no int default null,      -- optional (auto-managed if null)
  p_final_letter text default null, -- optional (auto-detected from Qualy rank or heat order if null)
  p_max_karts int default 12,
  p_rows jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.drivers;
  v_league_id uuid;
  v_season_id uuid;
  v_caller_app_role text;
  v_caller_db_role public.league_role;
  v_clean_kind public.session_kind;
  v_safe_karts int := greatest(coalesce(p_max_karts, 12), 1);
  v_session_id uuid;
  v_upload_id uuid;
  v_row jsonb;
  v_driver_id uuid;
  v_raw_comp text;
  v_comp_norm text;
  v_start_num text;
  v_pos int;
  v_status public.result_status;
  v_laps int;
  v_total_ms int;
  v_gap_ms int;
  v_gap_laps int;
  v_best_ms int;
  v_second_ms int;
  v_best_lap_no int;
  v_best_speed numeric(7, 3);
  v_team_id uuid;
  v_base_handle text;
  v_candidate_handle text;
  v_suffix int;
  v_quali_pos bigint;
  v_row_letter char(1);
begin
  v_actor := public.fn_ensure_current_driver();

  select e.league_id, e.season_id
  into v_league_id, v_season_id
  from public.events e
  where e.id = p_event_id;

  if v_league_id is null then
    raise exception 'Selected race event not found';
  end if;

  select m.app_role, m.role
  into v_caller_app_role, v_caller_db_role
  from public.league_members m
  where m.league_id = v_league_id and m.driver_id = v_actor.id;

  if not found or (
    v_caller_app_role not in ('ADMIN', 'CO-ADMIN') and
    v_caller_db_role not in ('owner', 'organiser')
  ) then
    raise exception 'Only League Admins can upload race results';
  end if;

  if upper(trim(coalesce(p_kind, ''))) in ('QUALI', 'QUALY', 'QUALIFYING') then
    v_clean_kind := 'QUALI'::public.session_kind;
  else
    v_clean_kind := 'FINAL'::public.session_kind;
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No result rows provided to upload';
  end if;

  -- Process each row, resolving driver identity, team entry, and target session (Qualy or Final A..Z)
  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_raw_comp := trim(coalesce(v_row ->> 'rawCompetitorName', 'Driver'));
    if v_raw_comp = '' then
      v_raw_comp := 'Driver';
    end if;

    v_driver_id := nullif(trim(coalesce(v_row ->> 'driverId', '')), '')::uuid;
    v_start_num := nullif(trim(coalesce(v_row ->> 'startNumber', '')), '');

    -- If no existing driver was selected, create or reuse a guest driver in this league
    if v_driver_id is null then
      v_comp_norm := lower(regexp_replace(v_raw_comp, '\s+', ' ', 'g'));

      select da.driver_id into v_driver_id
      from public.driver_aliases da
      where da.league_id = v_league_id and da.alias_norm = v_comp_norm
      limit 1;

      if v_driver_id is null then
        v_base_handle := lower(regexp_replace(v_raw_comp, '[^a-zA-Z0-9_-]+', '-', 'g'));
        v_base_handle := trim(both '-' from v_base_handle);
        if length(v_base_handle) < 2 then
          v_base_handle := 'guest-' || substr(gen_random_uuid()::text, 1, 6);
        end if;
        v_base_handle := substr(v_base_handle, 1, 30);
        v_candidate_handle := '@' || v_base_handle;
        v_suffix := 0;
        while exists (select 1 from public.drivers where handle = v_candidate_handle) loop
          v_suffix := v_suffix + 1;
          v_candidate_handle := '@' || v_base_handle || '-' || v_suffix::text;
        end loop;

        insert into public.drivers (display_name, handle, driver_number)
        values (v_raw_comp, v_candidate_handle, coalesce(v_start_num, ''))
        returning id into v_driver_id;

        insert into public.league_members (league_id, driver_id, role, app_role)
        values (v_league_id, v_driver_id, 'racer', 'RACER')
        on conflict (league_id, driver_id) do nothing;
      end if;
    end if;

    -- Save confirmed alias in `driver_aliases` so future uploads auto-match
    v_comp_norm := lower(regexp_replace(v_raw_comp, '\s+', ' ', 'g'));
    if v_comp_norm <> '' then
      insert into public.driver_aliases (league_id, alias_norm, alias_raw, driver_id, confirmed_by)
      values (v_league_id, v_comp_norm, v_raw_comp, v_driver_id, v_actor.id)
      on conflict (league_id, alias_norm) do update
      set driver_id = excluded.driver_id, confirmed_by = excluded.confirmed_by;
    end if;

    -- Sync driver's team into `event_entries`
    select tr.team_id into v_team_id
    from public.team_roster tr
    where tr.season_id = v_season_id and tr.driver_id = v_driver_id
    limit 1;

    begin
      insert into public.event_entries (event_id, driver_id, team_id, is_reserve)
      values (p_event_id, v_driver_id, v_team_id, false)
      on conflict (event_id, driver_id) do update
      set team_id = coalesce(excluded.team_id, public.event_entries.team_id);
    exception when others then
      null;
    end;

    -- Determine which session this driver's result belongs to:
    -- For QUALI: all qualifying results for the event merge into batch 1 (or keep each driver's best qualifying lap across heats)
    -- For FINAL: auto-detect the driver's Final letter ('A'..'Z') from row payload, or from their Combined Qualifying rank (`v_combined_quali`), or default 'A'
    if v_clean_kind = 'QUALI' then
      select s.id into v_session_id
      from public.sessions s
      where s.event_id = p_event_id and s.kind = 'QUALI' and s.batch_no = 1;

      if v_session_id is null then
        insert into public.sessions (event_id, kind, batch_no, final_letter)
        values (p_event_id, 'QUALI', 1, null)
        returning id into v_session_id;
      end if;
    else
      -- Check if row specifies a `finalLetter`, otherwise derive from `v_combined_quali` split_pos & `v_safe_karts`
      v_row_letter := substr(upper(trim(coalesce(nullif(v_row ->> 'finalLetter', ''), nullif(p_final_letter, ''), ''))), 1, 1);

      if v_row_letter is null or v_row_letter = '' then
        select cq.split_pos into v_quali_pos
        from public.v_combined_quali cq
        where cq.event_id = p_event_id and cq.driver_id = v_driver_id
        limit 1;

        if v_quali_pos is not null and v_quali_pos > 0 then
          v_row_letter := chr(65 + least(25, ((v_quali_pos - 1) / v_safe_karts)::int));
        else
          v_row_letter := 'A';
        end if;
      end if;

      insert into public.event_finals (event_id, letter, slots)
      values (p_event_id, v_row_letter, v_safe_karts)
      on conflict (event_id, letter) do update set slots = excluded.slots;

      -- Remove this driver from any other Final session in the same event so a driver is only classified once per event
      delete from public.session_results sr
      using public.sessions s
      where sr.session_id = s.id
        and s.event_id = p_event_id
        and s.kind = 'FINAL'
        and sr.driver_id = v_driver_id;

      select s.id into v_session_id
      from public.sessions s
      where s.event_id = p_event_id and s.kind = 'FINAL' and s.final_letter = v_row_letter;

      if v_session_id is null then
        insert into public.sessions (event_id, kind, batch_no, final_letter)
        values (p_event_id, 'FINAL', null, v_row_letter)
        returning id into v_session_id;
      end if;
    end if;

    -- Ensure a published `uploads` row exists for `v_session_id` so we can upsert drivers across multiple CSV files!
    select u.id into v_upload_id
    from public.uploads u
    where u.session_id = v_session_id and u.status = 'published'
    limit 1;

    if v_upload_id is null then
      insert into public.uploads (
        session_id,
        storage_path,
        sha256,
        uploaded_by,
        status,
        published_at
      ) values (
        v_session_id,
        v_league_id::text || '/' || p_event_id::text || '/' || v_session_id::text || '/' || gen_random_uuid()::text || '.csv',
        md5(v_session_id::text || '-' || clock_timestamp()::text || '-' || random()::text),
        v_actor.id,
        'published',
        now()
      )
      returning id into v_upload_id;
    else
      update public.uploads set published_at = now() where id = v_upload_id;
    end if;

    v_pos := nullif(trim(coalesce(v_row ->> 'posInSession', '')), '')::int;
    v_status := coalesce(nullif(upper(trim(coalesce(v_row ->> 'status', 'FIN'))), ''), 'FIN')::public.result_status;
    v_laps := nullif(trim(coalesce(v_row ->> 'laps', '')), '')::int;
    v_total_ms := nullif(trim(coalesce(v_row ->> 'totalTimeMs', '')), '')::int;
    v_gap_ms := nullif(trim(coalesce(v_row ->> 'gapMs', '')), '')::int;
    v_gap_laps := nullif(trim(coalesce(v_row ->> 'gapLaps', '')), '')::int;
    v_best_ms := nullif(trim(coalesce(v_row ->> 'bestLapMs', '')), '')::int;
    v_second_ms := nullif(trim(coalesce(v_row ->> 'secondBestLapMs', '')), '')::int;
    v_best_lap_no := nullif(trim(coalesce(v_row ->> 'bestLapNo', '')), '')::int;
    v_best_speed := nullif(trim(coalesce(v_row ->> 'bestSpeedKmh', '')), '')::numeric(7, 3);

    insert into public.session_results (
      session_id,
      upload_id,
      driver_id,
      raw_competitor_name,
      pos_in_session,
      start_number,
      class,
      status,
      laps,
      total_time_ms,
      gap_ms,
      gap_laps,
      best_lap_ms,
      second_best_lap_ms,
      best_lap_no,
      best_speed_kmh,
      raw
    ) values (
      v_session_id,
      v_upload_id,
      v_driver_id,
      v_raw_comp,
      v_pos,
      v_start_num,
      nullif(trim(coalesce(v_row ->> 'className', '')), ''),
      v_status,
      v_laps,
      v_total_ms,
      v_gap_ms,
      v_gap_laps,
      v_best_ms,
      v_second_ms,
      v_best_lap_no,
      v_best_speed,
      coalesce(v_row -> 'raw', '{}'::jsonb)
    )
    on conflict (upload_id, driver_id) do update
    set
      raw_competitor_name = excluded.raw_competitor_name,
      pos_in_session = excluded.pos_in_session,
      start_number = excluded.start_number,
      status = excluded.status,
      laps = excluded.laps,
      total_time_ms = excluded.total_time_ms,
      gap_ms = excluded.gap_ms,
      gap_laps = excluded.gap_laps,
      -- For QUALI, keep the faster best lap if a driver appeared in more than one file
      best_lap_ms = case
        when v_clean_kind = 'QUALI' and public.session_results.best_lap_ms is not null and excluded.best_lap_ms is not null
          then least(public.session_results.best_lap_ms, excluded.best_lap_ms)
        else coalesce(excluded.best_lap_ms, public.session_results.best_lap_ms)
      end,
      second_best_lap_ms = coalesce(excluded.second_best_lap_ms, public.session_results.second_best_lap_ms),
      best_lap_no = coalesce(excluded.best_lap_no, public.session_results.best_lap_no),
      best_speed_kmh = coalesce(excluded.best_speed_kmh, public.session_results.best_speed_kmh),
      raw = excluded.raw;
  end loop;

  return v_upload_id;
end;
$$;

notify pgrst, 'reload schema';
