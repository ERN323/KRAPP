-- =====================================================================================================
-- KRAPP schema v1  (Supabase / Postgres 15+)
-- Source of truth for leagues, race days, raw results, penalties, tags.
-- Standings / classification / licence are COMPUTED (views + functions), never stored.
-- The logic mirrors parser/classify.py and parser/licence.py (unit-tested reference implementation).
-- NOT YET RUN against a database: run `supabase start` + `supabase db reset` locally first.
--
-- IDs: gen_random_uuid() (UUID v4) - unique at any scale. Switch default to uuidv7() once on Postgres 18.
-- =====================================================================================================

-- ------------------------------------------------------------------ enums
create type session_kind  as enum ('QUALI', 'FINAL');
create type result_status as enum ('FIN', 'DNF', 'DNS', 'DSQ');
create type penalty_kind  as enum ('TIME', 'DSQ');
create type league_role   as enum ('owner', 'organiser', 'racer');
create type upload_status as enum ('draft', 'published', 'superseded');

-- ------------------------------------------------------------------ people & leagues
create table drivers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users (id) on delete set null,  -- null = guest (claimable later)
  display_name  text not null,
  handle        text not null unique check (handle ~ '^@[a-z0-9_-]{2,40}$'),
  created_at    timestamptz not null default now()
);

create table leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_by  uuid references drivers (id),
  created_at  timestamptz not null default now()
);

create table league_members (
  league_id  uuid not null references leagues (id) on delete cascade,
  driver_id  uuid not null references drivers (id) on delete cascade,
  role       league_role not null default 'racer',
  joined_at  timestamptz not null default now(),
  primary key (league_id, driver_id)
);

-- name as written in track CSVs -> driver (per league, confirmed by organiser in the upload preview)
create table driver_aliases (
  league_id        uuid not null references leagues (id) on delete cascade,
  normalised_name  text not null,          -- parse_speedhive.normalise_name()
  driver_id        uuid not null references drivers (id) on delete cascade,
  primary key (league_id, normalised_name)
);

-- ------------------------------------------------------------------ rules & seasons
create table points_schemes (
  id                   uuid primary key default gen_random_uuid(),
  league_id            uuid not null references leagues (id) on delete cascade,
  name                 text not null,
  final_points         int[] not null,             -- [P1, P2, ...] on OVERALL classification
  quali_points         int[] not null default '{}', -- [P1, P2, ...] on combined quali
  pole_bonus           int not null default 0,
  fastest_lap_bonus    int not null default 0,     -- fastest non-DSQ lap over ALL finals
  dnf_scores_position  boolean not null default true,
  dns_points           int not null default 0,
  drop_rounds          int not null default 0 check (drop_rounds >= 0)  -- a DSQ round cannot be dropped
);

create table licence_rules (
  id                    uuid primary key default gen_random_uuid(),
  league_id             uuid not null references leagues (id) on delete cascade,
  points_per_second     numeric not null default 1,
  dsq_points            numeric not null default 0,
  decay_per_clean_race  numeric not null default 0.5,
  ban_threshold         numeric not null default 10,
  post_ban_factor       numeric not null default 0.5
);

create table seasons (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references leagues (id) on delete cascade,
  name              text not null,
  starts_on         date,
  ends_on           date,
  points_scheme_id  uuid not null references points_schemes (id),
  licence_rules_id  uuid not null references licence_rules (id),
  unique (league_id, name)
);

-- ------------------------------------------------------------------ teams & tags
create table teams (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references leagues (id) on delete cascade,
  season_id  uuid not null references seasons (id) on delete cascade,
  name       text not null,
  unique (season_id, name)
);

create table team_roster (   -- regular drivers, fixed for the season
  team_id    uuid not null references teams (id) on delete cascade,
  season_id  uuid not null references seasons (id) on delete cascade,
  driver_id  uuid not null references drivers (id) on delete cascade,
  primary key (team_id, driver_id),
  unique (season_id, driver_id)          -- one team per driver per season
);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references leagues (id) on delete cascade,
  name       text not null,              -- e.g. '95kg+', 'Debitant'
  colour     text,
  unique (league_id, name)
);

create table driver_tags (   -- per season (A8): 'Debitant' only in the first season, weight can change
  driver_id  uuid not null references drivers (id) on delete cascade,
  tag_id     uuid not null references tags (id) on delete cascade,
  season_id  uuid not null references seasons (id) on delete cascade,
  primary key (driver_id, tag_id, season_id)
);

-- ------------------------------------------------------------------ race days
create table tracks (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  layout  text not null default '',
  unique (name, layout)
);

create table events (        -- created via "Schedule Race"
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references leagues (id) on delete cascade,
  season_id   uuid not null references seasons (id) on delete cascade,
  track_id    uuid references tracks (id),
  name        text not null,
  event_date  date not null,
  round_no    int not null,
  unique (season_id, round_no)
);

create table event_entries ( -- team per race day: pre-filled from team_roster, reserves added per race
  event_id    uuid not null references events (id) on delete cascade,
  driver_id   uuid not null references drivers (id) on delete cascade,
  team_id     uuid references teams (id),
  is_reserve  boolean not null default false,
  primary key (event_id, driver_id)
);

create table event_finals (  -- organiser: "Set finals"
  event_id  uuid not null references events (id) on delete cascade,
  letter    char(1) not null check (letter ~ '^[A-Z]$'),
  slots     int not null check (slots > 0),
  primary key (event_id, letter)
);

create table final_assignments (
  event_id   uuid not null references events (id) on delete cascade,
  driver_id  uuid not null references drivers (id) on delete cascade,
  letter     char(1) not null,
  primary key (event_id, driver_id),
  foreign key (event_id, letter) references event_finals (event_id, letter) on delete cascade
);

create table sessions (      -- one per quali batch / final
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events (id) on delete cascade,
  kind          session_kind not null,
  batch_no      int,
  final_letter  char(1),
  check ((kind = 'QUALI' and batch_no is not null and final_letter is null)
      or (kind = 'FINAL' and final_letter is not null and batch_no is null)),
  unique nulls not distinct (event_id, kind, batch_no, final_letter)
);

create table uploads (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions (id) on delete cascade,
  storage_path    text not null,           -- raw file in bucket 'results-raw', never modified
  sha256          text not null,
  uploaded_by     uuid references drivers (id),
  status          upload_status not null default 'draft',
  parse_warnings  jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  published_at    timestamptz
);
create unique index uploads_one_published_per_session on uploads (session_id) where status = 'published';
create unique index uploads_no_duplicate_file on uploads (sha256) where status <> 'superseded';

create table session_results (  -- raw parsed rows, never edited after publish
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references sessions (id) on delete cascade,
  upload_id           uuid not null references uploads (id) on delete cascade,
  driver_id           uuid not null references drivers (id),
  raw_competitor_name text not null,
  pos_in_session      int,              -- local to this batch/final
  start_number        text,             -- kart number, NOT identity
  class               text,
  status              result_status not null,
  laps                int,
  total_time_ms       int,
  gap_ms              int,
  gap_laps            int,
  best_lap_ms         int,
  second_best_lap_ms  int,              -- needs SpeedHive lap-times export (O1)
  best_lap_no         int,
  best_speed_kmh      numeric(7, 3),
  raw                 jsonb not null,   -- original header -> original string (for the master CSV)
  unique (upload_id, driver_id)
);
create index on session_results (driver_id);
create index on session_results (session_id);

create table penalties (     -- entered AFTER the upload, per driver per race day
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  session_id  uuid references sessions (id) on delete cascade,  -- the final, for TIME
  driver_id   uuid not null references drivers (id),
  kind        penalty_kind not null,
  seconds     numeric(6, 3) not null default 0,
  reason      text not null default '',
  created_by  uuid references drivers (id),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  check ((kind = 'TIME' and seconds > 0 and session_id is not null)
      or (kind = 'DSQ' and seconds = 0 and session_id is null))
);
create index on penalties (event_id, driver_id);

-- =====================================================================================================
-- Helper functions (security definer: used inside RLS without recursion)
-- =====================================================================================================
create function auth_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where user_id = auth.uid()
$$;

create function is_league_member(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members m where m.league_id = p_league and m.driver_id = auth_driver_id())
$$;

create function is_league_organiser(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members m
                 where m.league_id = p_league and m.driver_id = auth_driver_id() and m.role in ('owner', 'organiser'))
$$;

create function league_of_event(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select league_id from events where id = p_event
$$;

create function league_of_session(p_session uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select e.league_id from sessions s join events e on e.id = s.event_id where s.id = p_session
$$;

-- the creator of a league becomes its owner (otherwise RLS would block the first league_members row)
create function trg_league_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth_driver_id() is not null then
    insert into league_members (league_id, driver_id, role) values (new.id, auth_driver_id(), 'owner');
  end if;
  return new;
end
$$;
create trigger leagues_add_owner after insert on leagues for each row execute function trg_league_owner();

create function fmt_ms(ms int) returns text language sql immutable as $$
  select case when ms is null then null
              else lpad((ms / 60000)::text, 2, '0') || ':' || to_char((ms % 60000) / 1000.0, 'FM00.000') end
$$;

-- =====================================================================================================
-- Views: classification & points (security_invoker -> RLS of the caller applies)
-- =====================================================================================================
create view v_results with (security_invoker = true) as        -- published rows only
select r.*, s.event_id, s.kind, s.batch_no, s.final_letter,
       e.league_id, e.season_id, e.round_no, e.event_date, e.track_id
from session_results r
join uploads  u on u.id = r.upload_id and u.status = 'published'
join sessions s on s.id = r.session_id
join events   e on e.id = s.event_id;

create view v_event_dsq with (security_invoker = true) as       -- DSQ = out of the whole race day
select event_id, driver_id from penalties where kind = 'DSQ' and revoked_at is null
union
select event_id, driver_id from v_results where status = 'DSQ';

-- best lap across ALL quali batches; tie -> 2nd best lap; still tied -> shared (rank)
create view v_combined_quali with (security_invoker = true) as
with laps as (
  select event_id, driver_id, unnest(array[best_lap_ms, second_best_lap_ms]) as lap_ms
  from v_results where kind = 'QUALI'
), ordered as (
  select event_id, driver_id, lap_ms,
         row_number() over (partition by event_id, driver_id order by lap_ms) as rn
  from laps where lap_ms is not null
), quali_drivers as (
  select distinct event_id, driver_id from v_results where kind = 'QUALI'
), per_driver as (
  select q.event_id, q.driver_id,
         min(o.lap_ms) filter (where o.rn = 1) as best_lap_ms,
         min(o.lap_ms) filter (where o.rn = 2) as second_best_lap_ms,
         bool_or(x.driver_id is not null)      as is_dsq
  from quali_drivers q
  left join ordered o     on o.event_id = q.event_id and o.driver_id = q.driver_id
  left join v_event_dsq x on x.event_id = q.event_id and x.driver_id = q.driver_id
  group by q.event_id, q.driver_id
)
select p.*,
       rank() over (partition by p.event_id
                    order by p.best_lap_ms nulls last, p.second_best_lap_ms nulls last) as split_pos,
       case when not p.is_dsq then
         rank() over (partition by p.event_id, p.is_dsq
                      order by p.best_lap_ms nulls last, p.second_best_lap_ms nulls last) end as points_pos
from per_driver p;

-- "Set finals": suggested split A -> B -> C from the combined quali (letter null = did not qualify)
create function fn_suggest_final_split(p_event uuid)
returns table (driver_id uuid, letter char(1), split_pos bigint)
language sql stable as $$
  with q as (
    select cq.driver_id, cq.split_pos, row_number() over (order by cq.split_pos, cq.driver_id) as n
    from v_combined_quali cq where cq.event_id = p_event and not cq.is_dsq
  ), f as (
    select ef.letter,
           sum(ef.slots) over (order by ef.letter) - ef.slots + 1 as from_n,
           sum(ef.slots) over (order by ef.letter)                 as to_n
    from event_finals ef where ef.event_id = p_event
  )
  select q.driver_id, f.letter, q.split_pos
  from q left join f on q.n between f.from_n and f.to_n
  order by q.n
$$;

-- inside each final: FIN by laps desc, then total time + time penalties; then DNF; then DNS. DSQ removed.
create view v_final_ranked with (security_invoker = true) as
with pen as (
  select session_id, driver_id, (sum(seconds) * 1000)::int as penalty_ms
  from penalties where kind = 'TIME' and revoked_at is null
  group by session_id, driver_id
)
select r.event_id, r.league_id, r.season_id, r.final_letter, r.driver_id, r.status, r.laps,
       r.total_time_ms, r.best_lap_ms,
       coalesce(p.penalty_ms, 0)                   as penalty_ms,
       r.total_time_ms + coalesce(p.penalty_ms, 0) as adjusted_time_ms,
       row_number() over (
         partition by r.event_id, r.final_letter
         order by case r.status when 'FIN' then 0 when 'DNF' then 1 else 2 end,
                  r.laps desc nulls last,
                  r.total_time_ms + coalesce(p.penalty_ms, 0) nulls last,
                  r.pos_in_session nulls last) as block_pos
from v_results r
left join pen p on p.session_id = r.session_id and p.driver_id = r.driver_id
where r.kind = 'FINAL'
  and not exists (select 1 from v_event_dsq x where x.event_id = r.event_id and x.driver_id = r.driver_id);

-- overall = A block, then B, then C...; DSQ rows listed with no position (everyone below moved up)
create view v_event_classification with (security_invoker = true) as
select fr.*,
       row_number() over (partition by fr.event_id order by fr.final_letter, fr.block_pos) as overall_pos
from v_final_ranked fr
union all
select r.event_id, r.league_id, r.season_id, r.final_letter, r.driver_id, 'DSQ'::result_status, r.laps,
       r.total_time_ms, r.best_lap_ms, 0, null::int, null::bigint, null::bigint
from v_results r
join v_event_dsq x on x.event_id = r.event_id and x.driver_id = r.driver_id
where r.kind = 'FINAL';

create view v_event_points with (security_invoker = true) as
with base as (
  select e.id as event_id, e.league_id, e.season_id, e.round_no, d.driver_id
  from events e
  join (select event_id, driver_id from v_results
        union select event_id, driver_id from v_event_dsq) d on d.event_id = e.id
), fl as (    -- fastest non-DSQ lap of all finals; tie -> better overall position
  select distinct on (c.event_id) c.event_id, c.driver_id
  from v_event_classification c
  where c.status <> 'DSQ' and c.best_lap_ms is not null
  order by c.event_id, c.best_lap_ms, c.overall_pos
), pts as (
  select b.*, c.overall_pos, q.points_pos as quali_pos, (x.driver_id is not null) as is_dsq,
         case when x.driver_id is not null then 0
              when c.status = 'DNS' then ps.dns_points
              when c.status = 'DNF' and not ps.dnf_scores_position then 0
              else coalesce(ps.final_points[c.overall_pos::int], 0) end                     as race_points,
         case when x.driver_id is null and q.best_lap_ms is not null
              then coalesce(ps.quali_points[q.points_pos::int], 0) else 0 end               as quali_points,
         case when x.driver_id is null and q.best_lap_ms is not null and q.points_pos = 1
              then ps.pole_bonus else 0 end                                                 as pole_points,
         case when fl.driver_id is not null then ps.fastest_lap_bonus else 0 end            as fastest_lap_points
  from base b
  join seasons s         on s.id = b.season_id
  join points_schemes ps on ps.id = s.points_scheme_id
  left join v_event_classification c on c.event_id = b.event_id and c.driver_id = b.driver_id
  left join v_combined_quali q       on q.event_id = b.event_id and q.driver_id = b.driver_id
  left join v_event_dsq x            on x.event_id = b.event_id and x.driver_id = b.driver_id
  left join fl                       on fl.event_id = b.event_id and fl.driver_id = b.driver_id
)
select pts.*, race_points + quali_points + pole_points + fastest_lap_points as total_points from pts;

-- season standings: drop N worst rounds (not DSQ rounds); countback on sorted positions; then latest result
create view v_driver_standings with (security_invoker = true) as
with raced_events as (
  select e.id as event_id, e.season_id, e.round_no
  from events e where exists (select 1 from v_results r where r.event_id = e.id)
), season_drivers as (
  select distinct season_id, league_id, driver_id from v_event_points
), grid as (
  select sd.season_id, sd.league_id, sd.driver_id, re.event_id, re.round_no,
         coalesce(p.total_points, 0) as pts, coalesce(p.is_dsq, false) as is_dsq, p.overall_pos
  from season_drivers sd
  join raced_events re on re.season_id = sd.season_id
  left join v_event_points p on p.event_id = re.event_id and p.driver_id = sd.driver_id
), ranked as (
  select g.*, case when not g.is_dsq then
           row_number() over (partition by g.season_id, g.driver_id, g.is_dsq order by g.pts, g.round_no) end as drop_rank
  from grid g
), totals as (
  select r.season_id, r.league_id, r.driver_id,
         sum(r.pts) filter (where r.drop_rank is null or r.drop_rank > ps.drop_rounds) as points,
         count(*) filter (where r.overall_pos = 1)                                     as wins,
         array_agg(coalesce(r.overall_pos, 9999) order by coalesce(r.overall_pos, 9999)) as countback,
         (array_agg(r.overall_pos order by r.round_no desc) filter (where r.overall_pos is not null))[1] as latest_pos
  from ranked r
  join seasons s on s.id = r.season_id
  join points_schemes ps on ps.id = s.points_scheme_id
  group by r.season_id, r.league_id, r.driver_id
)
select t.*, rank() over (partition by t.season_id
                         order by t.points desc, t.countback, t.latest_pos nulls last) as pos
from totals t;

-- team points = sum of all drivers who drove for the team that race day (regulars + reserves)
create view v_team_standings with (security_invoker = true) as
select p.season_id, p.league_id, ee.team_id, t.name as team_name,
       sum(p.total_points) as points,
       rank() over (partition by p.season_id order by sum(p.total_points) desc) as pos
from v_event_points p
join event_entries ee on ee.event_id = p.event_id and ee.driver_id = p.driver_id
join teams t on t.id = ee.team_id
group by p.season_id, p.league_id, ee.team_id, t.name;

-- a driver's history across ALL leagues (RLS: others only see leagues they share)
create view v_driver_history with (security_invoker = true) as
select p.driver_id, p.league_id, l.name as league_name, p.season_id, e.id as event_id, e.name as event_name,
       e.event_date, tr.name as track_name, p.quali_pos, p.overall_pos, p.is_dsq, p.total_points
from v_event_points p
join events e  on e.id = p.event_id
join leagues l on l.id = p.league_id
left join tracks tr on tr.id = e.track_id;

create view v_personal_bests with (security_invoker = true) as   -- per track: lap times differ by track
select r.driver_id, r.track_id, min(r.best_lap_ms) as best_lap_ms
from v_results r where r.best_lap_ms is not null
group by r.driver_id, r.track_id;

-- drivers who raced a final they were not assigned to (or without assignment)
create view v_final_assignment_mismatch with (security_invoker = true) as
select r.event_id, r.driver_id, r.final_letter as raced_in, fa.letter as assigned_to
from v_results r
left join final_assignments fa on fa.event_id = r.event_id and fa.driver_id = r.driver_id
where r.kind = 'FINAL' and fa.letter is distinct from r.final_letter;

-- =====================================================================================================
-- Tag filters: keep tagged drivers (ALL given tags), re-number among them, keep original pos/points
-- =====================================================================================================
create function fn_driver_standings(p_season uuid, p_tag_ids uuid[] default null)
returns table (driver_id uuid, tag_pos bigint, overall_pos bigint, points bigint, wins bigint)
language sql stable as $$
  select s.driver_id, rank() over (order by s.pos), s.pos, s.points, s.wins
  from v_driver_standings s
  where s.season_id = p_season
    and (coalesce(cardinality(p_tag_ids), 0) = 0 or s.driver_id in (
          select dt.driver_id from driver_tags dt
          where dt.season_id = p_season and dt.tag_id = any (p_tag_ids)
          group by dt.driver_id having count(distinct dt.tag_id) = cardinality(p_tag_ids)))
  order by s.pos
$$;

create function fn_event_classification(p_event uuid, p_tag_ids uuid[] default null)
returns table (driver_id uuid, final_letter char(1), tag_pos bigint, overall_pos bigint, status result_status,
               penalty_ms int, adjusted_time_ms int)
language sql stable as $$
  select c.driver_id, c.final_letter, rank() over (order by c.overall_pos), c.overall_pos, c.status,
         c.penalty_ms, c.adjusted_time_ms
  from v_event_classification c
  join events e on e.id = c.event_id
  where c.event_id = p_event and c.overall_pos is not null
    and (coalesce(cardinality(p_tag_ids), 0) = 0 or c.driver_id in (
          select dt.driver_id from driver_tags dt
          where dt.season_id = e.season_id and dt.tag_id = any (p_tag_ids)
          group by dt.driver_id having count(distinct dt.tag_id) = cardinality(p_tag_ids)))
  order by c.overall_pos
$$;

-- =====================================================================================================
-- Licence points ledger (mirrors parser/licence.py)
-- =====================================================================================================
create function fn_licence_ledger(p_season uuid)
returns table (driver_id uuid, event_id uuid, round_no int, started boolean, penalty_points numeric,
               had_penalty boolean, decay numeric, served_ban boolean, ban_violated boolean,
               balance numeric, banned_next boolean)
language plpgsql stable as $$
#variable_conflict use_column
declare
  lr        licence_rules%rowtype;
  d         record;
  ev        record;
  v_bal     numeric;
  v_banned  boolean;
begin
  select l.* into lr from seasons s join licence_rules l on l.id = s.licence_rules_id where s.id = p_season;
  if not found then
    raise exception 'season % not found', p_season;
  end if;

  for d in
    select distinct x.driver_id from (
      select r.driver_id from v_results r where r.season_id = p_season
      union
      select p.driver_id from penalties p join events e on e.id = p.event_id where e.season_id = p_season
    ) x
  loop
    v_bal := 0;          -- A4: every season starts at 0
    v_banned := false;
    for ev in
      select e.id, e.round_no,
             exists (select 1 from v_results r
                     where r.event_id = e.id and r.driver_id = d.driver_id and r.status <> 'DNS') as did_start,
             coalesce((select sum(case p.kind when 'TIME' then p.seconds * lr.points_per_second else lr.dsq_points end)
                       from penalties p
                       where p.event_id = e.id and p.driver_id = d.driver_id and p.revoked_at is null), 0) as pen_points,
             exists (select 1 from penalties p
                     where p.event_id = e.id and p.driver_id = d.driver_id and p.revoked_at is null) as had_pen
      from events e
      where e.season_id = p_season
      order by e.round_no
    loop
      driver_id      := d.driver_id;
      event_id       := ev.id;
      round_no       := ev.round_no;
      started        := ev.did_start;
      penalty_points := ev.pen_points;
      had_penalty    := ev.had_pen;
      served_ban     := v_banned;
      decay          := 0;
      if v_banned then                                   -- skips this race, then balance x factor (A2, A3)
        v_bal := v_bal * lr.post_ban_factor + ev.pen_points;
      else
        v_bal := v_bal + ev.pen_points;
        if ev.did_start and not ev.had_pen then          -- clean race (A1: only if he started)
          decay := least(v_bal, lr.decay_per_clean_race);
          v_bal := v_bal - decay;
        end if;
      end if;
      v_bal        := round(v_bal, 3);
      v_banned     := v_bal >= lr.ban_threshold;
      ban_violated := served_ban and ev.did_start;      -- A5: flag to organiser, no auto-change
      balance      := v_bal;
      banned_next  := v_banned;
      return next;
    end loop;
  end loop;
end
$$;

-- current balance = after the last race day that has published results
create view v_licence_status with (security_invoker = true) as
select distinct on (s.id, l.driver_id)
       s.league_id, s.id as season_id, l.driver_id, l.balance, l.banned_next as banned_for_next_event,
       l.event_id as last_event_id
from seasons s
cross join lateral fn_licence_ledger(s.id) l
where exists (select 1 from v_results r where r.event_id = l.event_id)
order by s.id, l.driver_id, l.round_no desc;

create view v_licence_flags with (security_invoker = true) as   -- raced while banned (late penalty, A5)
select s.league_id, s.id as season_id, l.*
from seasons s cross join lateral fn_licence_ledger(s.id) l
where l.ban_violated;

create function fn_is_banned(p_driver uuid, p_event uuid) returns boolean
language sql stable as $$
  select coalesce((select l.served_ban
                   from events e cross join lateral fn_licence_ledger(e.season_id) l
                   where e.id = p_event and l.event_id = p_event and l.driver_id = p_driver), false)
$$;

create function trg_block_banned_entry() returns trigger language plpgsql as $$
begin
  if fn_is_banned(new.driver_id, new.event_id) then
    raise exception 'Driver % is serving a licence ban at this race day', new.driver_id;
  end if;
  return new;
end
$$;
create trigger event_entries_ban_check before insert on event_entries
for each row execute function trg_block_banned_entry();

-- =====================================================================================================
-- Publish an upload (atomic replace of a session's results)
-- =====================================================================================================
create function fn_publish_upload(p_upload uuid) returns void
language plpgsql as $$
declare v_session uuid;
begin
  select session_id into v_session from uploads where id = p_upload and status = 'draft';
  if v_session is null then
    raise exception 'upload % not found or not a draft', p_upload;
  end if;
  if not is_league_organiser(league_of_session(v_session)) then
    raise exception 'only league owner/organisers can publish results';
  end if;
  update uploads set status = 'superseded' where session_id = v_session and status = 'published';
  update uploads set status = 'published', published_at = now() where id = p_upload;
end
$$;

-- =====================================================================================================
-- Master results CSV (export only; original SpeedHive values from raw jsonb)
-- =====================================================================================================
create view v_master_results_export with (security_invoker = true) as
select r.league_id, r.season_id, r.event_id,
       case r.kind when 'QUALI' then 'Quali' else 'Final' end               as "Session",
       coalesce(r.batch_no::text, r.final_letter)                            as "Heat",
       r.event_date                                                          as "Date",
       e.name                                                                as "Race name",
       d.handle                                                              as "Driver handle",
       coalesce((select string_agg(t.name, ';' order by t.name)
                 from driver_tags dt join tags t on t.id = dt.tag_id
                 where dt.driver_id = r.driver_id and dt.season_id = r.season_id), '') as "Tags",
       r.raw ->> 'Pos' as "Pos", r.raw ->> 'Start Number' as "Start Number", r.raw ->> 'Competitor' as "Competitor",
       r.raw ->> 'Class' as "Class", r.raw ->> 'Total Time' as "Total Time", r.raw ->> 'Diff' as "Diff",
       r.raw ->> 'Laps' as "Laps", r.raw ->> 'Best Lap' as "Best Lap", r.raw ->> 'Best Lap No.' as "Best Lap No.",
       r.raw ->> 'Best Speed' as "Best Speed",
       nullif(c.penalty_ms, 0) / 1000.0                                      as "Penalty (s)",
       case when c.penalty_ms > 0 then fmt_ms(c.adjusted_time_ms) end        as "Adjusted Total Time",
       case when x.driver_id is not null then 'DSQ'::result_status
            else coalesce(c.status, r.status) end                            as "Status",
       case when r.kind = 'FINAL' then c.overall_pos
            when x.driver_id is null then q.split_pos end                    as "Overall Pos"
from v_results r
join events  e on e.id = r.event_id
join drivers d on d.id = r.driver_id
left join v_event_classification c on r.kind = 'FINAL' and c.event_id = r.event_id and c.driver_id = r.driver_id
left join v_combined_quali q       on r.kind = 'QUALI' and q.event_id = r.event_id and q.driver_id = r.driver_id
left join v_event_dsq x            on x.event_id = r.event_id and x.driver_id = r.driver_id;

-- =====================================================================================================
-- Row Level Security
-- =====================================================================================================
alter table drivers enable row level security;
create policy drivers_read on drivers for select using (
  id = auth_driver_id()
  or exists (select 1 from league_members a join league_members b on b.league_id = a.league_id
             where a.driver_id = drivers.id and b.driver_id = auth_driver_id()));
create policy drivers_insert on drivers for insert with check (auth.uid() is not null);     -- guests via upload
create policy drivers_update_self on drivers for update using (user_id = auth.uid());

alter table leagues enable row level security;
create policy leagues_read on leagues for select using (is_league_member(id));
create policy leagues_create on leagues for insert with check (auth.uid() is not null);
create policy leagues_write on leagues for update using (is_league_organiser(id));

alter table tracks enable row level security;
create policy tracks_read on tracks for select using (auth.uid() is not null);
create policy tracks_insert on tracks for insert with check (auth.uid() is not null);

do $$
declare t text;
begin
  -- tables with league_id
  foreach t in array array['league_members', 'driver_aliases', 'points_schemes', 'licence_rules', 'seasons',
                           'teams', 'tags', 'events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_league_member(league_id))', t || '_read', t);
    execute format('create policy %I on %I for all using (is_league_organiser(league_id)) '
                   'with check (is_league_organiser(league_id))', t || '_write', t);
  end loop;
  -- tables with event_id
  foreach t in array array['event_entries', 'event_finals', 'final_assignments', 'sessions', 'penalties'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_league_member(league_of_event(event_id)))',
                   t || '_read', t);
    execute format('create policy %I on %I for all using (is_league_organiser(league_of_event(event_id))) '
                   'with check (is_league_organiser(league_of_event(event_id)))', t || '_write', t);
  end loop;
  -- tables with session_id
  foreach t in array array['uploads', 'session_results'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_league_member(league_of_session(session_id)))',
                   t || '_read', t);
    execute format('create policy %I on %I for all using (is_league_organiser(league_of_session(session_id))) '
                   'with check (is_league_organiser(league_of_session(session_id)))', t || '_write', t);
  end loop;
end
$$;

-- a driver always sees his own results, in every league (cross-league history)
create policy session_results_own on session_results for select using (driver_id = auth_driver_id());

alter table team_roster enable row level security;
create policy team_roster_read on team_roster for select using (
  is_league_member((select t.league_id from teams t where t.id = team_id)));
create policy team_roster_write on team_roster for all
  using (is_league_organiser((select t.league_id from teams t where t.id = team_id)))
  with check (is_league_organiser((select t.league_id from teams t where t.id = team_id)));

alter table driver_tags enable row level security;
create policy driver_tags_read on driver_tags for select using (
  is_league_member((select t.league_id from tags t where t.id = tag_id)));
create policy driver_tags_write on driver_tags for all
  using (is_league_organiser((select t.league_id from tags t where t.id = tag_id)))
  with check (is_league_organiser((select t.league_id from tags t where t.id = tag_id)));

-- raw CSV storage (private bucket); file path convention: <league_id>/<event_id>/<session_id>/<sha256>.csv
insert into storage.buckets (id, name, public) values ('results-raw', 'results-raw', false)
on conflict (id) do nothing;
