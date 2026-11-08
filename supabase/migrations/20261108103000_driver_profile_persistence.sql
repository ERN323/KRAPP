-- =====================================================================================================
-- Migration: Reliable Driver Profile Persistence Per Google Account / Email
-- Ensures every Google account's Name, Surname, Driver Number, Weight, Bio & Helmet are stored
-- permanently in `public.drivers` and restored every time the user logs out and logs back in.
-- =====================================================================================================

-- 1. Ensure all profile columns exist on `public.drivers`
alter table public.drivers add column if not exists email text;
alter table public.drivers add column if not exists first_name text not null default '';
alter table public.drivers add column if not exists surname text not null default '';
alter table public.drivers add column if not exists driver_number text not null default '';
alter table public.drivers add column if not exists weight_kg numeric(5, 2);
alter table public.drivers add column if not exists bio text not null default '';
alter table public.drivers add column if not exists avatar_type text not null default 'helmet';
alter table public.drivers add column if not exists helmet_id text not null default 'track-orange';
alter table public.drivers add column if not exists avatar_url text;

-- 2. Replace `fn_ensure_current_driver` so it links by `user_id` (or matching `email`),
--    preserves all saved profile fields on login, and only uses Google metadata as initial defaults.
drop function if exists public.fn_ensure_current_driver(text, text);
create or replace function public.fn_ensure_current_driver(
  p_display_name text default null,
  p_preferred_handle text default null,
  p_email text default null,
  p_avatar_url text default null
) returns public.drivers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_email text := lower(trim(coalesce(p_email, auth.jwt() ->> 'email', '')));
  v_driver public.drivers;
  v_base_handle text;
  v_candidate text;
  v_suffix int := 0;
  v_full_name text := trim(coalesce(p_display_name, auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', ''));
  v_first_name text := '';
  v_surname text := '';
  v_space_pos int;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Split Google full name into first_name and surname for initial defaults
  if v_full_name <> '' then
    v_space_pos := strpos(v_full_name, ' ');
    if v_space_pos > 0 then
      v_first_name := trim(substr(v_full_name, 1, v_space_pos - 1));
      v_surname := trim(substr(v_full_name, v_space_pos + 1));
    else
      v_first_name := v_full_name;
    end if;
  end if;

  -- A. Check if driver row already exists for this authenticated user_id
  select * into v_driver from public.drivers where user_id = v_uid;

  -- B. If not found by user_id, check if there is an existing driver row with the same email
  if not found and v_jwt_email <> '' then
    select * into v_driver
    from public.drivers
    where lower(email) = v_jwt_email
    limit 1;

    if found then
      update public.drivers
      set user_id = v_uid
      where id = v_driver.id
      returning * into v_driver;
    end if;
  end if;

  -- C. If driver row exists, preserve all their saved values (only backfill email or empty initial name if never set)
  if v_driver.id is not null then
    if (v_driver.email is null or v_driver.email = '') and v_jwt_email <> '' then
      update public.drivers
      set email = v_jwt_email
      where id = v_driver.id
      returning * into v_driver;
    end if;

    if v_driver.first_name = '' and v_driver.surname = '' and v_first_name <> '' then
      update public.drivers
      set
        first_name = v_first_name,
        surname = v_surname,
        display_name = coalesce(nullif(trim(v_full_name), ''), v_driver.display_name)
      where id = v_driver.id
      returning * into v_driver;
    end if;

    return v_driver;
  end if;

  -- D. Brand new user: generate a valid unique @handle and insert row
  v_base_handle := lower(regexp_replace(
    coalesce(
      nullif(trim(p_preferred_handle), ''),
      nullif(v_full_name, ''),
      nullif(split_part(v_jwt_email, '@', 1), ''),
      'driver'
    ),
    '[^a-zA-Z0-9_-]+', '-', 'g'
  ));
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

  insert into public.drivers (
    user_id,
    email,
    display_name,
    handle,
    first_name,
    surname,
    driver_number,
    avatar_type,
    helmet_id,
    avatar_url
  )
  values (
    v_uid,
    nullif(v_jwt_email, ''),
    coalesce(nullif(v_full_name, ''), upper(v_base_handle)),
    v_candidate,
    v_first_name,
    v_surname,
    '',
    'helmet',
    'track-orange',
    p_avatar_url
  )
  returning * into v_driver;

  return v_driver;
end;
$$;

-- 3. Dedicated RPC to save Driver Profile changes reliably into `public.drivers`
create or replace function public.fn_save_driver_profile(
  p_username text,
  p_first_name text,
  p_surname text,
  p_driver_number text,
  p_weight_kg numeric default null,
  p_bio text default '',
  p_avatar_type text default 'helmet',
  p_helmet_id text default 'track-orange',
  p_avatar_url text default null
) returns public.drivers
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers;
  v_base_handle text;
  v_candidate text;
  v_suffix int := 0;
  v_display_name text;
begin
  -- Ensure the caller's driver row exists first
  v_driver := public.fn_ensure_current_driver();

  -- Build a valid handle from p_username that satisfies `handle ~ '^@[a-z0-9_-]{2,40}$'`
  v_base_handle := lower(regexp_replace(
    coalesce(nullif(trim(regexp_replace(coalesce(p_username, ''), '^@+', '')), ''), 'driver'),
    '[^a-zA-Z0-9_-]+', '-', 'g'
  ));
  v_base_handle := trim(both '-' from v_base_handle);
  if length(v_base_handle) < 2 then
    v_base_handle := 'driver-' || substr(v_driver.id::text, 1, 6);
  end if;
  v_base_handle := substr(v_base_handle, 1, 32);

  v_candidate := '@' || v_base_handle;
  -- Ensure no collision with a different driver's handle
  while exists (
    select 1 from public.drivers
    where handle = v_candidate and id <> v_driver.id
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate := '@' || v_base_handle || '-' || v_suffix::text;
  end loop;

  v_display_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_surname, ''));
  if v_display_name = '' then
    v_display_name := upper(v_base_handle);
  end if;

  update public.drivers
  set
    handle = v_candidate,
    display_name = v_display_name,
    first_name = trim(coalesce(p_first_name, '')),
    surname = trim(coalesce(p_surname, '')),
    driver_number = trim(coalesce(p_driver_number, '')),
    weight_kg = p_weight_kg,
    bio = trim(coalesce(p_bio, '')),
    avatar_type = coalesce(nullif(trim(p_avatar_type), ''), 'helmet'),
    helmet_id = coalesce(nullif(trim(p_helmet_id), ''), 'track-orange'),
    avatar_url = p_avatar_url
  where id = v_driver.id
  returning * into v_driver;

  return v_driver;
end;
$$;

notify pgrst, 'reload schema';
