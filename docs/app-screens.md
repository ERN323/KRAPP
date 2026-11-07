# App screens: changes to the whiteboard flow

The current whiteboard has League settings (Upload race results, Assign roles, Manage racers, Schedule race, Invite
racers, Create team, Request to join team) and an Upload screen (Race/Quali, Date, Add CSV, Cancel, Upload result).

## Changed

### Upload Race Results
| Now | Change to | Why |
|---|---|---|
| Free `Date` field | Pick a **scheduled race day** (from Schedule Race). Date + name come from it | Avoids "Round 3" vs "R3" splitting one race into two |
| `Race / Quali` toggle | **Quali batch #** or **Final A/B/C** | Several files per race day |
| Add CSV → Upload result | Add CSV → **Preview** → Publish | Names must be matched before results count |
| none | Status per session: missing / draft / published | The organiser sees what's still missing for the day |

## New

### Preview & match drivers (after Add CSV)
- Parsed rows: pos, name, laps, best lap, total time, status (DNS highlighted)
- Each name: ✅ matched driver / ⚠️ suggestion / ❌ unknown → *map to existing driver*, *create guest*,
  *mark as reserve for team X*
- Parser warnings (e.g. "file was re-saved in Excel, ask the track for the raw export")
- Final files: drivers who weren't assigned to this final are flagged

### Set finals (after all quali batches are published)
- Combined quali table (best lap over all batches, shared positions highlighted)
- Inputs: number of finals and drivers per final → live preview of A / B / C lists
- Share/print the list for the track

### Penalties (per race day, any time later)
- Pick a driver → **+ seconds** (choose the final) or **DSQ**, plus a reason
- Preview: old → new position, licence points added
- List of penalties with edit/revoke

### Licence status
- Per driver: current balance (e.g. 7.5 / 10), history (added, −0.5, halved), **banned for next race**
- Organiser view: drivers close to 10, drivers banned for the next race, flags (raced while banned)

### Tags (league settings)
- Create tags (name, colour), assign them to drivers for the season (several per driver)

### Standings
- Tabs: Race day · Drivers · Teams. Tag filter chips (`All`, `95kg+`, `Debitant`…)
- With a filter on: position among the tagged drivers + their overall position in brackets

### Driver profile
- History across all their leagues (visible to the driver only), with personal bests per track
