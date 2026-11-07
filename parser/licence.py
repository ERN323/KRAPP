"""Licence-points ledger (reference implementation of SQL fn_licence_ledger).

Per league, per season (balance starts at 0 every season - assumption A4). For each event in order:
  1. If the driver is serving a ban at this event: he must not race (ban_violated if he did),
     no decay (A2), balance x post_ban_factor (A3: halves the actual balance), ban cleared.
  2. Otherwise: + penalty seconds x points_per_second + DSQ x dsq_points.
     If he started and received no penalty (time or DSQ) -> - decay_per_clean_race, floor 0 (A1).
  3. If balance >= ban_threshold -> banned for the next event.
Penalties entered later simply change the input; the ledger is recomputed from scratch (A5).
"""
from __future__ import annotations

from dataclasses import dataclass

from classify import DSQ_PEN, TIME, EventData


@dataclass
class LicenceRules:
    points_per_second: float = 1.0
    dsq_points: float = 0.0
    decay_per_clean_race: float = 0.5
    ban_threshold: float = 10.0
    post_ban_factor: float = 0.5


@dataclass
class LedgerRow:
    event_id: str
    started: bool
    penalty_points: float
    had_penalty: bool
    decay: float
    served_ban: bool
    ban_violated: bool  # raced while banned -> flag to organiser
    balance: float
    banned_next: bool


def driver_ledger(events: list[EventData], driver_id: str, rules: LicenceRules | None = None) -> list[LedgerRow]:
    rules = rules or LicenceRules()
    balance, banned = 0.0, False
    out: list[LedgerRow] = []
    for ev in sorted(events, key=lambda e: e.sequence):
        started = driver_id in ev.started()
        pens = [p for p in ev.penalties if p.driver_id == driver_id]
        pen_points = sum(p.seconds * rules.points_per_second for p in pens if p.kind == TIME)
        pen_points += sum(rules.dsq_points for p in pens if p.kind == DSQ_PEN)
        decay = 0.0
        served = banned
        if served:
            balance = balance * rules.post_ban_factor + pen_points  # penalties only if he raced anyway
        else:
            balance += pen_points
            if started and not pens:
                decay = min(balance, rules.decay_per_clean_race)
                balance -= decay
        balance = round(balance, 3)
        banned = balance >= rules.ban_threshold
        out.append(LedgerRow(ev.event_id, started, round(pen_points, 3), bool(pens), round(decay, 3),
                             served, served and started, balance, banned))
    return out


def season_ledgers(events: list[EventData], rules: LicenceRules | None = None) -> dict[str, list[LedgerRow]]:
    drivers = {e.driver_id for ev in events for es in list(ev.quali.values()) + list(ev.finals.values()) for e in es}
    drivers |= {p.driver_id for ev in events for p in ev.penalties}
    return {d: driver_ledger(events, d, rules) for d in sorted(drivers)}


def is_banned_for_next(events: list[EventData], driver_id: str, rules: LicenceRules | None = None) -> bool:
    rows = driver_ledger(events, driver_id, rules)
    return bool(rows) and rows[-1].banned_next
