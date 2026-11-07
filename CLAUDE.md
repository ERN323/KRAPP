# CLAUDE.md: KRAPP

KRAPP is a karting app: leagues, race days, SpeedHive (MYLAPS) result CSVs → standings, penalties, licence points,
driver history. Backend: Supabase. This is a personal project, separate from any Onboard Retail work.

## Read first
- `HANDOVER.md`: **start here**. Project history, current state, next steps, what the owner still has to provide
- `docs/results-strategy.md`: how results flow and every computation rule
- `docs/decisions.md`: confirmed decisions (source of truth for rules)
- `docs/open-questions.md`: unconfirmed assumptions A1–A15 and open questions O1–O9
- `docs/app-screens.md`: screens to add or change on the whiteboard flow

## Working rules
- **Challenge, don't just agree.** The owner wants unclear or questionable points flagged and asked about before
  building. Ask clarifying questions when a rule is ambiguous.
- **Terminology:** League (never "group"), Season, Race day/event, Session (quali batch / final), Team,
  Driver handle (unique id like `@troy-bowden`), Tag (category like `95kg+`).
- **Keep 4 places in sync when a rule changes:** `docs/decisions.md` (add a dated row), the Python reference
  (`parser/classify.py` or `parser/licence.py`), the SQL (`supabase/migrations/`, as a **new** numbered migration once
  001 has been applied), and the tests. Python is the tested reference, and SQL must give the same results.
- When an assumption gets answered, move it from `open-questions.md` to `decisions.md`.
- Raw results are never edited: corrections = new upload (supersedes the old one) or a penalty row.
- Don't modify the demo CSVs in the KRAPP root. Test copies live in `parser/tests/fixtures/`.
- Never put Supabase keys in files that get shared. Use a local `.env` (keep it out of any repo).

## Commands (run from this folder)
- Tests: `python -m unittest discover -s parser\tests -v` (stdlib only, no installs)
- Demo master CSV: `python parser\export.py` → `out\master_results_demo.csv`
- If the shell is Windows PowerShell 5.1: write scripts to `.py` files rather than `python -c "..."`
- SQL: not yet run against a database. Needs Docker Desktop + Supabase CLI (`supabase start`, `supabase db reset`)

## Files
| Path | What |
|---|---|
| `Qualifying_demo.csv`, `Race_Demo.csv` | Owner's demo exports (originals) |
| `parser/parse_speedhive.py` | CSV → normalised rows (header mapping, ms times, status, encoding/delimiter detection, warnings) |
| `parser/classify.py` | Combined quali, final split, classification with penalties/DSQ, points, standings, teams, tag filter |
| `parser/licence.py` | Licence-points ledger |
| `parser/export.py` | Master CSV export |
| `parser/tests/` | Unit tests + fixtures |
| `supabase/migrations/20261107000000_schema.sql` | Tables, RLS, views, functions |
| `out/` | Generated files |

## Known data quirks (SpeedHive CSV)
- Quali has no `Total Time`, Race has it in column 5. Always map by header
- `0` / `-` = no data. A DNS row still gets a `Pos`
- Files opened in Excel lose precision (`08:03.9`, `57.36`). Ask for raw exports
- `Diff` can be `1 Lap`. `Best Speed` includes `km/h`
- `Start Number` is the kart, not the driver
