"""Race-day classification, points and standings (reference implementation of the SQL views).

Rules (docs/decisions.md):
- Combined quali: best lap across ALL quali batches; tie -> 2nd-best lap; still tied -> shared position.
- Final split: organiser sets slots per final; filled A -> B -> C from the combined quali.
- Inside a final: FIN by (laps desc, total time + time penalties asc), then DNF (laps desc), then DNS.
  A time penalty therefore never moves a driver below someone with fewer laps, nor out of his final.
- Overall classification: A block, then B, then C... DSQ drivers are removed from the whole race day
  (no quali or race points) and everyone below moves up, across final borders.
- Fastest-lap bonus: fastest non-DSQ lap over all finals; tie -> better overall position.
- Standings: drop N worst rounds (a DSQ round cannot be dropped), tie-break by countback
  (most wins, then most P2, ...), then better result in the latest event.
- Tag filter: keep tagged drivers, re-number positions among them, keep original points/overall pos.
"""
from __future__ import annotations

from dataclasses import dataclass, field

FIN, DNF, DNS, DSQ = "FIN", "DNF", "DNS", "DSQ"
TIME, DSQ_PEN = "TIME", "DSQ"
_STATUS_ORDER = {FIN: 0, DNF: 1, DNS: 2}


@dataclass
class Entry:
    """One driver in one session (quali batch or final)."""
    driver_id: str
    status: str = FIN
    laps: int | None = None
    total_time_ms: int | None = None
    best_lap_ms: int | None = None
    second_best_lap_ms: int | None = None
    pos_in_session: int | None = None


@dataclass
class Penalty:
    driver_id: str
    kind: str  # TIME | DSQ
    seconds: float = 0.0
    final: str | None = None  # final letter, required for TIME
    reason: str = ""


@dataclass
class EventData:
    event_id: str
    sequence: int
    quali: dict[int, list[Entry]] = field(default_factory=dict)  # batch no -> entries
    finals: dict[str, list[Entry]] = field(default_factory=dict)  # letter -> entries
    penalties: list[Penalty] = field(default_factory=list)

    def dsq_drivers(self) -> set[str]:
        out = {p.driver_id for p in self.penalties if p.kind == DSQ_PEN}
        for entries in list(self.quali.values()) + list(self.finals.values()):
            out |= {e.driver_id for e in entries if e.status == DSQ}
        return out

    def started(self) -> set[str]:
        """Drivers who took part in any session (status other than DNS)."""
        return {
            e.driver_id
            for entries in list(self.quali.values()) + list(self.finals.values())
            for e in entries
            if e.status != DNS
        }


@dataclass
class PointsScheme:
    final_points: list[int]  # index 0 = overall P1
    quali_points: list[int] = field(default_factory=list)  # index 0 = combined quali P1
    pole_bonus: int = 0
    fastest_lap_bonus: int = 0
    dnf_scores_position: bool = True  # classified DNF gets the points of its position
    dns_points: int = 0
    drop_rounds: int = 0


# ---------------------------------------------------------------- helpers
def _competition_rank(items: list, key) -> list[int]:
    """1,2,2,4 ranking for an already sorted list."""
    ranks, prev, prev_rank = [], object(), 0
    for i, item in enumerate(items, start=1):
        k = key(item)
        if k != prev:
            prev_rank, prev = i, k
        ranks.append(prev_rank)
    return ranks


def _none_last(v):
    return (v is None, v if v is not None else 0)


# ---------------------------------------------------------------- quali
@dataclass
class QualiRow:
    driver_id: str
    pos: int
    best_lap_ms: int | None
    second_best_lap_ms: int | None
    shared: bool = False


def combined_quali(quali: dict[int, list[Entry]], exclude: set[str] | None = None) -> list[QualiRow]:
    exclude = exclude or set()
    laps: dict[str, list[int]] = {}
    for entries in quali.values():
        for e in entries:
            if e.driver_id in exclude:
                continue
            bucket = laps.setdefault(e.driver_id, [])
            bucket += [t for t in (e.best_lap_ms, e.second_best_lap_ms) if t]
    rows = []
    for driver, times in laps.items():
        times.sort()
        rows.append(QualiRow(driver, 0, times[0] if times else None, times[1] if len(times) > 1 else None))

    def key(r):
        return (_none_last(r.best_lap_ms), _none_last(r.second_best_lap_ms))

    rows.sort(key=lambda r: (key(r), r.driver_id))
    ranks = _competition_rank(rows, key)
    for r, rank in zip(rows, ranks):
        r.pos = rank
    counts: dict[int, int] = {}
    for r in rows:
        counts[r.pos] = counts.get(r.pos, 0) + 1
    for r in rows:
        r.shared = counts[r.pos] > 1
    return rows


def split_finals(combined: list[QualiRow], slots: dict[str, int]) -> tuple[dict[str, str], list[str], list[str]]:
    """-> (driver -> final letter, drivers not qualified for any final, warnings)."""
    assign: dict[str, str] = {}
    warnings: list[str] = []
    order = sorted(combined, key=lambda r: (r.pos, r.driver_id))
    letters = sorted(slots)
    i = 0
    for letter in letters:
        block = order[i : i + slots[letter]]
        for r in block:
            assign[r.driver_id] = letter
        i += slots[letter]
        if block and i < len(order) and order[i].pos == block[-1].pos:
            warnings.append(
                f"Quali tie at P{block[-1].pos} across the {letter}/{chr(ord(letter) + 1)} final border: organiser must decide."
            )
    dnq = [r.driver_id for r in order[i:]]
    if dnq:
        warnings.append(f"{len(dnq)} driver(s) did not fit in any final (open item O3).")
    return assign, dnq, warnings


# ---------------------------------------------------------------- finals
@dataclass
class ClassRow:
    driver_id: str
    final: str | None
    block_pos: int | None
    overall_pos: int | None
    status: str
    laps: int | None
    total_time_ms: int | None
    penalty_ms: int
    adjusted_time_ms: int | None


def _time_penalties_ms(event: EventData) -> dict[tuple[str, str], int]:
    out: dict[tuple[str, str], int] = {}
    for p in event.penalties:
        if p.kind != TIME:
            continue
        if p.final not in event.finals:
            raise ValueError(f"time penalty for {p.driver_id}: final {p.final!r} not found")
        if not any(e.driver_id == p.driver_id for e in event.finals[p.final]):
            raise ValueError(f"time penalty: {p.driver_id} did not race final {p.final}")
        k = (p.final, p.driver_id)
        out[k] = out.get(k, 0) + round(p.seconds * 1000)
    return out


def classify_event(event: EventData) -> list[ClassRow]:
    dsq = event.dsq_drivers()
    pens = _time_penalties_ms(event)
    ranked: list[ClassRow] = []
    disq: list[ClassRow] = []
    for letter in sorted(event.finals):
        block = []
        for e in event.finals[letter]:
            pen = pens.get((letter, e.driver_id), 0)
            adj = e.total_time_ms + pen if e.total_time_ms is not None else None
            row = ClassRow(e.driver_id, letter, None, None, DSQ if e.driver_id in dsq else e.status,
                           e.laps, e.total_time_ms, pen, adj)
            (disq if e.driver_id in dsq else block).append((row, e))
        block.sort(key=lambda re_: (
            _STATUS_ORDER.get(re_[0].status, 3),
            -(re_[0].laps or 0),
            _none_last(re_[0].adjusted_time_ms),
            _none_last(re_[1].pos_in_session),
        ))
        for n, (row, _) in enumerate(block, start=1):
            row.block_pos = n
            ranked.append(row)
    for n, row in enumerate(ranked, start=1):
        row.overall_pos = n
    return ranked + [row for row, _ in disq]


# ---------------------------------------------------------------- points
@dataclass
class PointsRow:
    driver_id: str
    overall_pos: int | None
    quali_pos: int | None
    race: int = 0
    quali: int = 0
    pole: int = 0
    fastest_lap: int = 0
    dsq: bool = False

    @property
    def total(self) -> int:
        return self.race + self.quali + self.pole + self.fastest_lap


def _pts(table: list[int], pos: int | None) -> int:
    return table[pos - 1] if pos and pos <= len(table) else 0


def event_points(event: EventData, scheme: PointsScheme) -> dict[str, PointsRow]:
    dsq = event.dsq_drivers()
    classification = classify_event(event)
    quali = combined_quali(event.quali, exclude=dsq)
    out: dict[str, PointsRow] = {}
    for r in classification:
        p = out.setdefault(r.driver_id, PointsRow(r.driver_id, r.overall_pos, None))
        if r.status == DSQ:
            p.dsq = True
        elif r.status == DNS:
            p.race = scheme.dns_points
        elif r.status == DNF and not scheme.dnf_scores_position:
            p.race = 0
        else:
            p.race = _pts(scheme.final_points, r.overall_pos)
    for d in dsq:
        out.setdefault(d, PointsRow(d, None, None, dsq=True))
    for q in quali:
        p = out.setdefault(q.driver_id, PointsRow(q.driver_id, None, None))
        p.quali_pos = q.pos
        if q.best_lap_ms is not None:
            p.quali = _pts(scheme.quali_points, q.pos)
            if q.pos == 1:
                p.pole = scheme.pole_bonus
    # fastest lap over all finals, non-DSQ
    pos_of = {r.driver_id: r.overall_pos for r in classification}
    laps = [(e.best_lap_ms, pos_of.get(e.driver_id) or 10**6, e.driver_id)
            for entries in event.finals.values() for e in entries
            if e.best_lap_ms and e.driver_id not in dsq]
    if laps and scheme.fastest_lap_bonus:
        out[min(laps)[2]].fastest_lap = scheme.fastest_lap_bonus
    return out


# ---------------------------------------------------------------- standings
@dataclass
class StandingRow:
    driver_id: str
    pos: int
    points: int
    per_event: list[int]
    dropped: list[int]  # event indexes dropped
    positions: list[int | None]  # overall pos per event
    tag_pos: int | None = None


def season_standings(events: list[EventData], scheme: PointsScheme) -> list[StandingRow]:
    events = sorted(events, key=lambda e: e.sequence)
    per_event = [event_points(e, scheme) for e in events]
    drivers = sorted({d for pe in per_event for d in pe})
    rows = []
    for d in drivers:
        totals = [pe[d].total if d in pe and not pe[d].dsq else 0 for pe in per_event]
        is_dsq = [d in pe and pe[d].dsq for pe in per_event]
        positions = [pe[d].overall_pos if d in pe else None for pe in per_event]
        droppable = sorted((t, i) for i, t in enumerate(totals) if not is_dsq[i])
        dropped = [i for _, i in droppable[: scheme.drop_rounds]]
        points = sum(t for i, t in enumerate(totals) if i not in dropped)
        rows.append(StandingRow(d, 0, points, totals, dropped, positions))

    max_pos = max((p for r in rows for p in r.positions if p), default=0)

    def key(r: StandingRow):
        countback = tuple(-sum(1 for p in r.positions if p == k) for k in range(1, max_pos + 1))
        latest = next((p for p in reversed(r.positions) if p), 10**6)
        return (-r.points, countback, latest)

    rows.sort(key=lambda r: (key(r), r.driver_id))
    for r, rank in zip(rows, _competition_rank(rows, key)):
        r.pos = rank
    return rows


def team_standings(events: list[EventData], scheme: PointsScheme,
                   entries: dict[str, dict[str, str]]) -> list[tuple[str, int, int]]:
    """entries: event_id -> {driver_id: team_id} (regulars + reserves for that race day).
    -> [(team_id, pos, points)]; a reserve's points stay with the team he drove for."""
    totals: dict[str, int] = {}
    for e in events:
        for d, p in event_points(e, scheme).items():
            team = entries.get(e.event_id, {}).get(d)
            if team and not p.dsq:
                totals[team] = totals.get(team, 0) + p.total
    rows = sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))
    ranks = _competition_rank(rows, key=lambda kv: kv[1])
    return [(t, rank, pts) for (t, pts), rank in zip(rows, ranks)]


def filter_by_tags(rows: list, tagged: set[str], pos_attr: str = "pos") -> list:
    """Keep rows whose driver holds the tag(s); set .tag_pos = position among them (shared on ties).
    Works for StandingRow (pos) and ClassRow (overall_pos)."""
    kept = sorted((r for r in rows if r.driver_id in tagged and getattr(r, pos_attr) is not None),
                  key=lambda r: getattr(r, pos_attr))
    for r, rank in zip(kept, _competition_rank(kept, key=lambda r: getattr(r, pos_attr))):
        r.tag_pos = rank
    return kept
