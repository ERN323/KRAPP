"""Master results CSV export (mirrors SQL view v_master_results_export).

Run from the KRAPP folder:  python parser\\export.py
Builds out\\master_results_demo.csv from the two demo files (Quali batch 1 + Final A of a 'Demo Race').
"""
from __future__ import annotations

import csv
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from classify import EventData, Entry, Penalty, classify_event, combined_quali  # noqa: E402
from parse_speedhive import FINAL, QUALI, ParsedFile, make_handle, parse_file  # noqa: E402

SPEEDHIVE_COLUMNS = ["Pos", "Start Number", "Competitor", "Class", "Total Time", "Diff", "Laps",
                     "Best Lap", "Best Lap No.", "Best Speed"]
MASTER_COLUMNS = (["Session", "Heat", "Date", "Race name", "Driver handle", "Tags"] + SPEEDHIVE_COLUMNS
                  + ["Penalty (s)", "Adjusted Total Time", "Status", "Overall Pos"])


@dataclass
class UploadedSession:
    kind: str  # QUALI | FINAL
    heat: str  # quali batch number ('1') or final letter ('A')
    parsed: ParsedFile


def fmt_ms(ms: int | None) -> str:
    if ms is None:
        return ""
    m, s = divmod(ms / 1000, 60)
    return f"{int(m):02d}:{s:06.3f}"


def to_entries(parsed: ParsedFile, driver_of: dict[str, str]) -> list[Entry]:
    return [Entry(driver_of[r.competitor_norm], r.status, r.laps, r.total_time_ms, r.best_lap_ms,
                  r.second_best_lap_ms, r.pos_in_session) for r in parsed.rows]


def master_rows(event_name: str, date: str, sessions: list[UploadedSession],
                driver_of: dict[str, str], handle_of: dict[str, str], tags_of: dict[str, list[str]],
                penalties: list[Penalty]) -> list[dict[str, str]]:
    event = EventData("demo", 1, penalties=penalties)
    for s in sessions:
        target = event.quali if s.kind == QUALI else event.finals
        target[int(s.heat) if s.kind == QUALI else s.heat] = to_entries(s.parsed, driver_of)
    quali_pos = {q.driver_id: q.pos for q in combined_quali(event.quali)}
    cls = {(c.final, c.driver_id): c for c in classify_event(event)}

    out = []
    for s in sessions:
        for r in s.parsed.rows:
            d = driver_of[r.competitor_norm]
            row = {"Session": "Quali" if s.kind == QUALI else "Final", "Heat": s.heat, "Date": date,
                   "Race name": event_name, "Driver handle": handle_of[d], "Tags": ";".join(tags_of.get(d, []))}
            row.update({c: r.raw.get(c, "") for c in SPEEDHIVE_COLUMNS})  # original values, untouched
            if s.kind == FINAL:
                c = cls[(s.heat, d)]
                row.update({"Penalty (s)": f"{c.penalty_ms / 1000:g}" if c.penalty_ms else "",
                            "Adjusted Total Time": fmt_ms(c.adjusted_time_ms) if c.penalty_ms else "",
                            "Status": c.status, "Overall Pos": c.overall_pos or ""})
            else:
                dsq = d in event.dsq_drivers()
                row.update({"Penalty (s)": "", "Adjusted Total Time": "",
                            "Status": "DSQ" if dsq else r.status, "Overall Pos": "" if dsq else quali_pos[d]})
            out.append(row)
    return out


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:  # BOM so Excel shows Ā/Ē/Š correctly
        w = csv.DictWriter(f, fieldnames=MASTER_COLUMNS)
        w.writeheader()
        w.writerows(rows)


def build_demo(root: Path) -> Path:
    fixtures = root / "parser" / "tests" / "fixtures"
    sessions = [UploadedSession(QUALI, "1", parse_file(fixtures / "Qualifying_demo.csv", QUALI)),
                UploadedSession(FINAL, "A", parse_file(fixtures / "Race_Demo.csv", FINAL))]
    # identity: in the app this is the alias lookup + organiser confirmation; here every name is a new guest
    driver_of, handle_of, taken = {}, {}, set()
    for s in sessions:
        for r in s.parsed.rows:
            if r.competitor_norm not in driver_of:
                d = f"drv-{len(driver_of) + 1:03d}"
                driver_of[r.competitor_norm] = d
                handle_of[d] = make_handle(r.competitor, taken)
                taken.add(handle_of[d])
    tags_of = {driver_of["warren bentley"]: ["95kg+"]}  # demo only, to show the column; default is no tag
    for s in sessions:
        for w in s.parsed.warnings:
            print(f"[{s.kind} {s.heat}] WARNING: {w}")
    out = root / "out" / "master_results_demo.csv"
    write_csv(master_rows("Demo Race", "2026-11-07", sessions, driver_of, handle_of, tags_of, []), out)
    return out


if __name__ == "__main__":
    print("written:", build_demo(Path(__file__).resolve().parent.parent))
