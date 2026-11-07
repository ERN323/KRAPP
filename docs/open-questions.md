# Open questions & assumptions

When one is answered: move it to [decisions.md](decisions.md), then update code, tests and SQL.

## Assumptions built into the code (confirm or correct)

| # | Assumption | Where |
|---|---|---|
| A1 | The −0.5 licence decay applies only to races the driver **started**. Absent = no change. Floor 0 | `licence.py`, `fn_licence_ledger` |
| A2 | The skipped (banned) race gives no −0.5. Halving happens once, after it | same |
| A3 | Halving uses the actual balance (12 → 6), not a fixed reset to 5 | same |
| A4 | The licence balance resets to 0 at the start of each season | same |
| A5 | Penalties can be edited/revoked later and everything is recomputed. A ban that lands on a race the driver already drove is **flagged**, not auto-changed | `v_licence_flags` |
| A6 | A DSQ after the finals doesn't redo the final split | `classify.py` |
| A7 | Time penalties apply to finals only. DSQ covers the whole race day | `penalties` check constraint |
| A8 | Tags are per league and assigned per driver **per season**. A driver can have several | `driver_tags` |
| A9 | A tag filter re-numbers positions among the tagged drivers and keeps the original points and overall position | `fn_driver_standings` |
| A10 | A filter with several tags = drivers holding **all** of them (e.g. `95kg+` AND `Debitant`) | `fn_driver_standings` |
| A11 | A DSQ round cannot be one of the dropped rounds | `season_standings`, `v_driver_standings` |
| A12 | A DSQ counts as a penalty for decay (no −0.5 that race), even though it gives 0 licence points | `licence.py` |
| A13 | A classified DNF scores the points of its position (setting `dnf_scores_position`) | `points_schemes` |
| A14 | Fastest-lap tie → the driver with the better overall position gets the bonus | `v_event_points` |
| A15 | Driver standings tie-break: countback (wins, P2s, …), then the better result at the latest race day | `v_driver_standings` |

## Open questions

| # | Question | Blocking? |
|---|---|---|
| O1 | Can the track export **lap times** per quali batch? Needed for the 2nd-best-lap tie-break. Without it, tied drivers share a position until the organiser decides | Before the first real race day |
| O2 | Confirm the extra master CSV columns: Heat, Penalty (s), Adjusted Total Time, Status, Overall Pos | No |
| O3 | More drivers than final slots: do the extra drivers get points? What about a driver who misses their final? | Before the first real race day |
| O4 | Gāzēju Kauss points table, quali/pole/fastest-lap bonus, drop rounds | Before standings go live |
| O5 | Should a DSQ ever give licence points? (Currently 0, one setting) | No |
| O6 | A ban earned at the **last race of a season**: does it carry into the next season? (Currently no, because the balance resets) | Before season end |
| O7 | GDPR: privacy notice for guest drivers whose names come from track CSVs | Before go-live |
| O8 | Could the SpeedHive API replace manual CSV uploads? (MYLAPS terms) | No |
| O9 | Can the 2nd-best lap be taken from the "Best Lap No." / lap chart, or does SpeedHive provide it directly? | Linked to O1 |
| O10 | Front-end stack for the app (Flutter, React Native/Expo, FlutterFlow, web…) | Before any app work |
| O11 | Auth provider strategy: email/password, Google Sign-In, or both. If both, how are an email account and a Google account for the same person linked (e.g. by matching email address)? | Before real sign-ups |
| O12 | The front-end teammate added `is_private`, `password`, `member_roles` (jsonb), `country`, `created_by_user_id` to `leagues` (see decisions.md, 2026-11-07 "Leagues RLS exposure"), overlapping with the existing `league_members` role table and introducing a plaintext password concept with no hashing. Needs a joint decision: is "password-protected private league" a real feature? If so, design it properly (hashed, not readable via the public API) and reconcile roles with `league_members` instead of a duplicate jsonb field | Before front-end work continues on this table |
