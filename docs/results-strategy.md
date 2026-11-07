# KRAPP: results, penalties & standings

How race results get from the track into KRAPP, and how standings, licence points and driver history are built
from them. Decisions and their dates are in [decisions.md](decisions.md). Unresolved items are in
[open-questions.md](open-questions.md).

## 1. Principles

1. **Supabase (Postgres) is the database.** The raw CSV from the track is stored unchanged in Storage (bucket
   `results-raw`) as the audit trail. Its rows are parsed into `session_results`, and those rows are never edited.
2. **Everything else is computed.** Combined qualifying, the final split, the classification, points, standings,
   team standings, licence points and history are SQL views and functions. A correction (re-upload, late penalty,
   revoked penalty) changes the inputs, and every number follows automatically.
3. **The "master CSV" is an export** (`v_master_results_export`), not a file we maintain.
4. **A driver is a UUID, not a name.** Names in track files are matched to drivers through per-league aliases
   that an organiser confirms. A guest driver (no account yet) can claim the profile later.

## 2. Terms

| Term | Meaning |
|---|---|
| League | A community with its own seasons, rules, drivers, teams (formerly "group"), e.g. Gāzēju Kauss |
| Season | A set of race days in a league with one points scheme and one licence rule set |
| Race day / event | One scheduled race: N quali batches + finals A, B, C… |
| Session | One quali batch or one final, with one CSV |
| Team | Sub-unit of a league for a season; regular drivers are fixed, and reserves are added per race day |
| Driver handle | Unique public id, e.g. `@troy-bowden` |
| Tag | Optional label on a driver for a season (`95kg+`, `Debitant`), used to filter results and standings |

## 3. Race-day flow

```
Schedule Race ─► Upload quali batch 1..N ─► Preview & match drivers ─► Publish
                                                                        │
                    Combined quali (best lap over all batches) ◄────────┘
                                │
           Set finals (slots per final) ─► A = top block, B = next block, …  ─► list for the track
                                │
         Upload final A, B, C ─► Preview & match ─► check vs final assignment ─► Publish
                                │
             Penalties (any time later): +X s on a final, or DSQ
                                │
       Classification ─► Points ─► Driver / Team / Tag standings ─► Licence points
```

### 3.1 Upload & parse (`parser/parse_speedhive.py`, later an Edge Function)

- The organiser picks the scheduled race day, then the session (`Quali batch n` or `Final X`), then the CSV. Date and
  race name come from the schedule and are never typed in.
- Columns are mapped **by header name**. Quali has no `Total Time`, Race has it in the middle.
- Times become milliseconds, and `0` / `-` mean empty. `Best Speed` loses its `km/h`. `Diff` `1 Lap` becomes a laps gap.
- Status: no laps means DNS. `DNF`/`DSQ` in `Pos` or `Diff` are recognised.
- The delimiter `,` / `;`, decimal comma, and UTF-8 / Windows-1257 encoding are detected.
- **Warnings** shown in the preview: times with < 3 decimals (the file was re-saved in Excel), no 2nd-best-lap
  column, duplicate names, unknown columns, and a session type that doesn't match the headers.
- A duplicate file (same SHA-256) is rejected. Publishing replaces the session's previous upload atomically
  (`fn_publish_upload`).

### 3.2 Combined qualifying (`v_combined_quali`)

- Best lap over **all** quali batches. The `Pos` inside a batch file is ignored.
- Tie: 2nd-best lap. Still tied, or no 2nd lap available: **shared position**, which the organiser resolves.
- A driver with no lap goes to the bottom.

### 3.3 Final split (`fn_suggest_final_split`, Set finals screen)

- The organiser enters drivers per final (e.g. A = 12, B = 12, C = 10).
- Filled in alphabetical order from the combined quali: P1–P12 go to A, P13–P24 to B, and so on.
- Warnings appear for a tie on a final border, and for drivers who don't fit in any final.
- After the finals: `v_final_assignment_mismatch` lists drivers who raced a different final than assigned.

### 3.4 Classification (`v_final_ranked`, `v_event_classification`)

Inside each final:
1. Finishers, by **laps completed (desc)**, then **total time + time penalties (asc)**
2. DNF (by laps completed)
3. DNS

Overall: the whole A block, then the B block, then C… The **B winner is the next position after the last A driver**.

| Situation | Effect |
|---|---|
| Time penalty | Adds seconds to the total time. The driver moves down only **inside his own final**, never below a driver with fewer laps |
| DNF in A | Bottom of the A block, still above the B winner |
| DSQ | Removed from the **whole race day**: no quali, race, pole or fastest-lap points. **Everyone below moves up, across final borders** (an A-final DSQ makes the B winner P(n-1)) |

### 3.5 Points (`v_event_points`), configurable per league in `points_schemes`

- Race points on the **overall** position (A1 = P1, B1 = last A + 1)
- Optional quali points on the combined quali position, plus a pole bonus
- Optional fastest-lap bonus: the fastest lap over **all** finals (it can be won from the B final)
- DNF scores its position (configurable). DNS scores `dns_points`

### 3.6 Standings

- **Driver** (`v_driver_standings`): season total after dropping the N worst rounds (a DSQ round can't be dropped).
  Tie-break: countback (more wins, then more P2s, …), then the better result at the latest race day.
- **Team** (`v_team_standings`): the sum of every driver who drove for the team that race day (`event_entries`), so a
  reserve's points stay with the team he drove for. Reserves also appear in the driver standings.
- **Tag filter** (`fn_driver_standings(season, tags)`, `fn_event_classification(event, tags)`): only drivers holding
  the tag(s), with positions re-numbered among them (`tag_pos`). Points and overall position stay unchanged.
- **History** (`v_driver_history`): a driver's results across all leagues. Row Level Security means another
  member only sees the leagues they share with that driver.
- **Personal bests** (`v_personal_bests`): per track, because lap times can't be compared across tracks.

## 4. Licence points (`fn_licence_ledger`, `v_licence_status`)

Per league, per season, starting at 0. For each race day in order:

| Step | Rule |
|---|---|
| Penalty | +1 licence point per penalty second. DSQ = 0 points (setting `dsq_points`) |
| Clean race | Started and got no penalty (time or DSQ): **−0.5**, never below 0. Not started: no change |
| Limit | Balance **≥ 10** → banned from the **next** race day. `event_entries` blocks the driver (trigger) |
| After the ban | The banned race gives no −0.5. After it, the **balance is halved** (10 → 5, 10.5 → 5.25) |
| Late penalty | Everything is recomputed. If a ban falls on a race the driver already drove, it's **flagged** (`v_licence_flags`), not changed automatically |

Example: +6 s (6) → clean (5.5) → +5 s (10.5, banned) → skips the race (5.25) → clean (4.75).

All thresholds live in `licence_rules`, one row per league.

## 5. Data model (summary)

`drivers` · `leagues` · `league_members` (owner/organiser/racer) · `driver_aliases` · `points_schemes` ·
`licence_rules` · `seasons` · `teams` · `team_roster` · `tags` · `driver_tags` (per season) · `tracks` · `events` ·
`event_entries` (team per race day, reserves) · `event_finals` (slots) · `final_assignments` · `sessions` ·
`uploads` · `session_results` · `penalties`

Full definitions: `supabase/migrations/20261107000000_schema.sql`.

Security: Row Level Security on every table. Members read their league. Only the owner and organisers write
(results, penalties, finals, tags, teams). A driver can always read their own results in any league.

## 6. Master results CSV (`v_master_results_export`)

`Session, Heat, Date, Race name, Driver handle, Tags,` + the original SpeedHive columns
`Pos, Start Number, Competitor, Class, Total Time, Diff, Laps, Best Lap, Best Lap No., Best Speed,` +
`Penalty (s), Adjusted Total Time, Status, Overall Pos`.

The SpeedHive values are the original strings. Total Time is empty for quali. "Overall Pos" means the combined quali
position for quali rows and the overall classification for final rows. Example: `out/master_results_demo.csv`.

## 7. Code map

| File | Role |
|---|---|
| `parser/parse_speedhive.py` | CSV parsing & normalisation (becomes the upload Edge Function) |
| `parser/classify.py` | Reference logic: quali, split, classification, points, standings, teams, tags |
| `parser/licence.py` | Reference logic: licence ledger |
| `parser/export.py` | Builds the master CSV (demo) |
| `parser/tests/test_krapp.py` | 24 tests covering every rule above |
| `supabase/migrations/20261107000000_schema.sql` | Tables, RLS, views, functions (the same rules in SQL) |
