# Decision log

Newest at the bottom. Change a rule only by adding a new line here, then update code and tests.

| Date | Topic | Decision |
|---|---|---|
| 2026-11-07 | Database | Supabase tables are the source of truth. The master CSV is an export only |
| 2026-11-07 | Identity | Names are auto-matched through per-league aliases, and the organiser confirms in a preview. Unknown names become guest drivers (claimable) |
| 2026-11-07 | Naming | "Group" is called **League** everywhere (UI, database, API) |
| 2026-11-07 | Naming | The identifier column in the master CSV is the **Driver handle**. "Tags" are categories |
| 2026-11-07 | Points | Configurable per league/season |
| 2026-11-07 | Race-day format | Several quali batches + several finals (A, B, C…), because there are more drivers than karts |
| 2026-11-07 | Combined quali | Best lap across all quali batch files. Tie → 2nd-best lap |
| 2026-11-07 | Final split | The organiser sets drivers per final, filled alphabetically (A = top block) |
| 2026-11-07 | Classification | A-final positions first, then B (B winner = last A + 1), then C |
| 2026-11-07 | DNF in A | Stays above the B winner |
| 2026-11-07 | Fastest lap | Bonus (if used) over all finals |
| 2026-11-07 | Teams | Sub-unit inside a league. Team points = sum of all team drivers. No mid-season changes for regular drivers |
| 2026-11-07 | Reserves | Can be added for single races. Their points stay with that team, and they appear in driver standings normally |
| 2026-11-07 | Class | The column will be empty: stored, not used |
| 2026-11-07 | Privacy | Only the driver sees his own cross-league history |
| 2026-11-07 | Rights | League owner + organisers upload results and enter penalties |
| 2026-11-07 | Penalties | Entered later, separately from the CSV, per driver per race. Types: time (seconds added to the race) or DSQ |
| 2026-11-07 | Time penalty | Re-ranks only inside that final. Laps completed come first, so a penalty never drops a driver below someone with fewer laps |
| 2026-11-07 | DSQ | Removed from the race day: no race or quali points. Everyone below moves up, across final borders |
| 2026-11-07 | Licence points | 1 penalty second = 1 point. DSQ = 0 points. Per league, per season |
| 2026-11-07 | Licence decay | −0.5 for every race without a new penalty |
| 2026-11-07 | Licence ban | At 10 points the driver skips the next race. After the skipped race the balance is halved (10 → 5) |
| 2026-11-07 | Tags | No tag by default. Organisers can add tags (e.g. `95kg+`, `Debitant`) to filter results and standings |
| 2026-11-07 | Supabase region | `eu-north-1` (Stockholm), not Frankfurt. Both are EU/EEA (GDPR is satisfied either way); Stockholm is the closest AWS region Supabase offers to the owner's location in Latvia (~500 km vs ~1,500 km to Frankfurt). Project ref `skxossiiffqrfejvicyl` |
| 2026-11-07 | Leagues RLS exposure (incident + fix) | A teammate, building the front-end against this same Supabase project, added columns to `leagues` (`name`, `country`, `is_private`, `password`, `created_by_user_id`, `member_roles`) and 4 new RLS policies (`"Allow public ... on leagues"`, `using (true)` for anon+authenticated) directly via the SQL editor, outside the migration workflow. Because Postgres OR-combines permissive policies, these stacked on top of the original `leagues_read`/`leagues_create`/`leagues_write` policies and made the table fully public (read/write/delete, including a plaintext password column) to anyone — the anon key is necessarily public once the app ships, regardless of repo privacy. Fixed in `supabase/migrations/20261107120000_fix_leagues_public_rls.sql` (drops the 4 public policies; original restrictive ones take back over). Verified: anon insert now returns 401. The new **columns were intentionally left in place** — see open question O12 for the unresolved design conflict with the existing `league_members`-based role model |

Assumptions not yet confirmed: [open-questions.md](open-questions.md).
