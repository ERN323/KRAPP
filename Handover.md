# HANDOVER: start here (for Claude on the owner's personal PC)

This project was started on 2026-11-07 in a Claude Code session on another computer and moved here as a folder.
That conversation is **not** available to you. This file, `CLAUDE.md` and `docs/` contain everything that was agreed.
Read in this order: **this file → `CLAUDE.md` → `docs/decisions.md` → `docs/open-questions.md` →
`docs/results-strategy.md`**.

## 1. Who and what

- **Owner:** Rihards. Building **KRAPP**, a karting app for amateur racing communities ("leagues"). The first league is
  **Gāzēju Kauss** (Latvia). The owner isn't a full-time developer, so explain technical steps plainly and step by step.
- **Backend:** Supabase (Postgres + Auth + Storage). The front-end stack is **not decided yet** (see section 6).
- **Input data:** after every race day the karting track sends SpeedHive (MYLAPS) CSV exports, one per quali batch
  and one per final. Demo files: `Qualifying_demo.csv`, `Race_Demo.csv` in this folder.
- **Original whiteboard flow** (an image you don't have; its text):
  - League settings screen with an organiser section: *Upload race results, Assign roles, Manage racers, Schedule race*.
    A racer section: *Invite racers, Create team*. A driver section: *Request to join team*.
  - Upload screen: *Race/Quali* selector, *Date*, *Add CSV*, *Cancel*, *Upload result*.
  - The agreed changes to these screens are in `docs/app-screens.md`.

## 2. How the owner wants to work

- **Be critical.** The owner explicitly asked: "Do not support this idea but rather flag everything unclear and that you
  feel is not right." Challenge assumptions, point out risks, and ask clarifying questions before building.
- Ask questions as **short multiple-choice options with a recommended option** when possible. That worked well.
- Plan first, get approval, then build. Requirements come in bit by bit (penalties, reserves and tags were all
  added mid-design), so expect changes and keep `docs/decisions.md` current.
- Rules for keeping docs, Python, SQL and tests in sync are in `CLAUDE.md`.

## 3. How the design evolved (so you know why things are the way they are)

1. The first idea was a "master CSV" collecting all results, with a "Driver TAG based on driver name". This was **rejected**:
   Supabase tables are the source of truth, the CSV is only an export, and drivers are identified by UUID + a
   confirmed name alias, never by name.
2. "Groups" were renamed **Leagues**.
3. Race days have **several quali batches and A/B/C finals** (more drivers than karts). This replaced the original
   "1 quali + 1 race" idea.
4. **Penalties** (time or DSQ), added later per driver, and a **licence-points** system (10 points means skipping the next race).
5. **Reserve drivers**: their points stay with the team they drove for that day.
6. **Driver tags** (`95kg+`, `Debitant`) to filter results and standings. The old "Driver TAG" identifier became
   the **Driver handle**.

## 4. Current state (as of 2026-11-07)

| Item | State |
|---|---|
| Python reference logic (`parser/`) | Done. **24 unit tests pass** (Python 3.14, stdlib only) |
| Master CSV demo (`out/master_results_demo.csv`) | Generated from the demo files, 10 rows, checked |
| Supabase schema (`supabase/migrations/20261107000000_schema.sql`) | **Run successfully** against the live project on first try, no fixes needed |
| Docs (`docs/`) | Up to date |
| Supabase project | **Created.** Project `krapp`, ref `skxossiiffqrfejvicyl`, region `eu-north-1` (Stockholm — see decisions.md). Linked via CLI, schema pushed, 20 tables + `results-raw` bucket + RLS + Email auth all verified in dashboard |
| Edge Function for uploads, front-end app | Not started |

Update 2026-11-07: the schema was pushed to the live project (Postgres 17.11) and ran clean on the first try —
none of the anticipated trouble spots (the `fn_licence_ledger` OUT-parameter names, the `union all` column types
in `v_event_classification`, the RLS `do $$` block, the `storage.buckets` insert, `unique nulls not distinct`)
actually caused a failure. Keep this in mind only as context for why the SQL looks the way it does.

## 5. Next steps, in order

### Step 1: check the transfer (do this first)
1. Python 3.10+ must be installed (the code uses `int | None` syntax). Check with `python --version`.
2. From this folder, run: `python -m unittest discover -s parser/tests -v`. **All 24 must pass.**
3. `python parser/export.py` should rewrite `out/master_results_demo.csv` without errors.

### Step 2: connect Supabase — DONE (2026-11-07, on the owner's personal PC)
Completed on 2026-11-07. Project `krapp`, ref `skxossiiffqrfejvicyl`, region `eu-north-1` (Stockholm, not the
Frankfurt originally planned — see `docs/decisions.md`, 2026-11-07 "Supabase region" row). Schema pushed clean on
the first try, no fixes needed. All 4 dashboard checks (20 tables, `results-raw` bucket, no RLS warnings, Email
auth enabled) verified by the owner. `.env` filled in by the owner (never shared in chat); Supabase CLI installed
to `%LOCALAPPDATA%\SupabaseCLI` (winget had no package, Scoop's piped installer was blocked by the sandbox, so the
GitHub release zip was downloaded and extracted directly). The original steps below are kept for reference only:

1. supabase.com → sign up → Organization `KRAPP` (Free) → New project `krapp`, generate a DB password and store it
   in a password manager. Note the **project ref** from the URL.
2. Project Settings → API Keys: the Project URL, the **publishable** (anon) key, and the **secret** (service_role) key.
   The owner must **never paste keys into chat**. Create a `.env` file (and a `.gitignore` containing `.env`) for the
   owner to fill in themselves.
3. Install the Supabase CLI. Windows: Scoop (`irm get.scoop.sh | iex`, then
   `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` and `scoop install supabase`) — note
   this piped-script install is blocked by the auto-mode sandbox on this machine; downloading the release zip from
   `github.com/supabase/cli/releases` and extracting it worked instead. macOS: `brew install supabase/tap/supabase`.
4. `supabase login` needs an interactive TTY — the owner must run it themselves in their own terminal, not via a
   tool-run shell. Then `supabase init` → `supabase link --project-ref <ref>`.
5. **Rename** `supabase/migrations/001_schema.sql` to `20261107000000_schema.sql` (the CLI's timestamp format) and
   update the references in `CLAUDE.md` and `docs/`.
6. `supabase db push --remote` (the CLI defaults to a local Docker stack without `--remote`). Fix errors and
   re-run (the project is empty, so it's safe). Alternative without the CLI: paste the SQL into Dashboard → SQL
   Editor → Run.
7. Check: Table Editor shows 20 tables, Storage has the private bucket `results-raw`, the Security Advisor shows no
   "RLS disabled" warning, and Authentication → Email provider is enabled.
8. Note: on the free tier the project pauses after about 1 week of inactivity (Restore it in the dashboard).

### Step 3: make the SQL match the Python
Seed a test league (2 leagues sharing a driver, teams with a reserve, 3 race days with 3 quali batches and A/B finals,
a time penalty, a DSQ, tags), then check that the SQL views give the same answers as `parser/classify.py` /
`parser/licence.py` for the cases in `parser/tests/test_krapp.py`. A seed script + parity check would be a good
deliverable (`supabase/seed.sql` and a small comparison script).

### Step 4: upload pipeline
A Supabase Edge Function (TypeScript) port of `parser/parse_speedhive.py`: upload to Storage → parse → draft
`uploads` + `session_results` → preview/alias matching → `fn_publish_upload`.

### Step 5: front-end
The stack isn't chosen yet (open question O10). Ask the owner before building anything.

## 6. Waiting on the owner
- Confirm or correct assumptions **A1–A15** in `docs/open-questions.md`
- A **real race day's full set** of raw SpeedHive exports (never opened in Excel), and whether the track can export
  **lap times** (O1, for the 2nd-best-lap tie-break)
- The Gāzēju Kauss **points table**, quali/pole/fastest-lap bonuses, drop rounds, and the **list of tags** (O4)
- Whether a ban earned at the last race of a season carries into the next season (O6)
- A privacy notice for guest drivers (O7)
- **O10: the front-end stack** (e.g. Flutter, React Native/Expo, FlutterFlow, web app). Not discussed yet

## 7. Do not
- Don't edit the demo CSVs in the root. Tests use the copies in `parser/tests/fixtures/`
- Don't commit or share `.env` or any Supabase secret key
- Don't reintroduce "group" or name-based driver identity
- Don't change a rule silently: add a dated row to `docs/decisions.md` and update Python, SQL and tests together
