"""Run from the KRAPP folder:  python -m unittest discover -s parser\\tests -v"""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from classify import (DNF, DNS, DSQ, DSQ_PEN, FIN, TIME, Entry, EventData, Penalty, PointsScheme,  # noqa: E402
                      classify_event, combined_quali, event_points, filter_by_tags, season_standings,
                      split_finals, team_standings)
from licence import LicenceRules, driver_ledger  # noqa: E402
from parse_speedhive import (FINAL, QUALI, make_handle, normalise_name, parse_bytes, parse_diff,  # noqa: E402
                             parse_file, parse_speed_kmh, parse_time_ms)

FIX = HERE / "fixtures"
SCHEME = PointsScheme(final_points=[25, 18, 15, 12, 10, 8, 6, 4, 2, 1], quali_points=[3, 2, 1],
                      pole_bonus=1, fastest_lap_bonus=1)


def fin(d, laps, t, pos, best=50000):
    return Entry(d, FIN, laps, t, best, None, pos)


# ====================================================================== parser
class ParserDemoFiles(unittest.TestCase):
    def test_quali_demo(self):
        p = parse_file(FIX / "Qualifying_demo.csv", QUALI)
        self.assertEqual(p.kind, QUALI)
        self.assertEqual(len(p.rows), 5)
        troy = p.rows[0]
        self.assertEqual((troy.competitor, troy.best_lap_ms, troy.best_speed_kmh, troy.gap_ms),
                         ("Troy Bowden", 53378, 70.951, 0))
        terry = p.rows[4]
        self.assertEqual(terry.status, DNS)
        self.assertIsNone(terry.best_lap_ms)
        self.assertIsNone(terry.gap_ms)
        self.assertTrue(any("2nd-best-lap" in w for w in p.warnings))

    def test_race_demo(self):
        p = parse_file(FIX / "Race_Demo.csv", FINAL)
        self.assertEqual(p.kind, FINAL)
        self.assertEqual(p.rows[0].total_time_ms, 483900)  # 08:03.9
        self.assertEqual(p.rows[1].gap_ms, 3628)
        self.assertEqual(p.rows[3].best_lap_ms, 57360)  # '57.36' (Excel dropped the trailing zero)
        self.assertEqual(p.rows[4].status, DNS)  # Terry Pryor
        self.assertIsNone(p.rows[4].total_time_ms)
        self.assertTrue(any("decimal" in w for w in p.warnings), "tenths-only precision warning")

    def test_kind_mismatch_warns(self):
        p = parse_file(FIX / "Race_Demo.csv", QUALI)
        self.assertTrue(any("headers look like FINAL" in w for w in p.warnings))


class ParserEdgeCases(unittest.TestCase):
    def test_semicolon_cp1257_decimal_comma_lapped(self):
        text = ("Pos;Start Number;Competitor;Class;Total Time;Diff;Laps;Best Lap;Best Lap No.;Best Speed\n"
                "1;7;Jānis Bērziņš;;8:03,912;0;9;53,334;7;71,009 km/h\n"
                "2;8;Līga Ozoliņa;;8:10,001;1 Lap;8;55,100;3;68,700 km/h\n"
                "3;9;Pēteris Kalniņš;;;DNF;4;56,000;2;67,000 km/h\n")
        p = parse_bytes(text.encode("cp1257"), FINAL)
        self.assertEqual((p.encoding, p.delimiter), ("cp1257", ";"))
        self.assertEqual(p.rows[0].competitor, "Jānis Bērziņš")
        self.assertEqual(p.rows[0].competitor_norm, "janis berzins")
        self.assertEqual(p.rows[0].total_time_ms, 483912)
        self.assertEqual(p.rows[1].gap_laps, 1)
        self.assertEqual(p.rows[2].status, DNF)
        self.assertFalse(any("decimal" in w for w in p.warnings), "ms precision -> no warning")

    def test_value_parsers(self):
        self.assertEqual(parse_time_ms("1:02:03.456"), (3723456, 3))
        self.assertEqual(parse_time_ms("-"), (None, None))
        self.assertEqual(parse_time_ms("0"), (None, None))
        self.assertEqual(parse_diff("2 Laps"), (None, 2, None))
        self.assertEqual(parse_diff("DSQ"), (None, None, DSQ))
        self.assertAlmostEqual(parse_speed_kmh("44.000 mph"), 70.811, places=3)
        self.assertEqual(normalise_name("  T.  BOWDEN "), "t bowden")
        self.assertEqual(make_handle("Troy Bowden", {"@troy-bowden"}), "@troy-bowden-2")

    def test_missing_required_column(self):
        with self.assertRaises(ValueError):
            parse_bytes(b"Pos,Competitor\n1,X\n")


# ====================================================================== quali + split
class QualiAndSplit(unittest.TestCase):
    def test_combined_across_batches_and_tiebreak(self):
        quali = {
            1: [Entry("a", best_lap_ms=53000, second_best_lap_ms=53500), Entry("b", best_lap_ms=53200)],
            2: [Entry("c", best_lap_ms=53000, second_best_lap_ms=53100), Entry("d", status=DNS)],
        }
        rows = combined_quali(quali)
        self.assertEqual([(r.driver_id, r.pos) for r in rows], [("c", 1), ("a", 2), ("b", 3), ("d", 4)])

    def test_tie_without_second_lap_is_shared(self):
        rows = combined_quali({1: [Entry("a", best_lap_ms=53000)], 2: [Entry("b", best_lap_ms=53000)]})
        self.assertEqual([r.pos for r in rows], [1, 1])
        self.assertTrue(all(r.shared for r in rows))

    def test_driver_in_two_batches_best_counts(self):
        rows = combined_quali({1: [Entry("a", best_lap_ms=54000)], 2: [Entry("a", best_lap_ms=53000),
                                                                       Entry("b", best_lap_ms=53500)]})
        self.assertEqual([(r.driver_id, r.best_lap_ms, r.second_best_lap_ms) for r in rows][0], ("a", 53000, 54000))

    def test_split_alphabetical_blocks(self):
        combined = combined_quali({1: [Entry(f"d{i:02d}", best_lap_ms=50000 + i) for i in range(1, 11)]})
        assign, dnq, _ = split_finals(combined, {"A": 4, "B": 4, "C": 2})
        self.assertEqual([assign[f"d{i:02d}"] for i in range(1, 11)], list("AAAABBBBCC"))
        self.assertEqual(dnq, [])
        _, dnq, warns = split_finals(combined, {"A": 4, "B": 4})
        self.assertEqual(dnq, ["d09", "d10"])
        self.assertTrue(warns)


# ====================================================================== finals, penalties, DSQ
def race_day(penalties=()):
    return EventData("e1", 1,
                     quali={1: [Entry(d, best_lap_ms=50000 + i) for i, d in enumerate(["a1", "a2", "a3", "a4"])],
                            2: [Entry(d, best_lap_ms=51000 + i) for i, d in enumerate(["b1", "b2", "b3"])]},
                     finals={"A": [fin("a1", 10, 600000, 1, 49000), fin("a2", 10, 602000, 2),
                                   fin("a3", 10, 605000, 3), fin("a4", 9, 590000, 4)],
                             "B": [fin("b1", 10, 610000, 1, 48500), fin("b2", 10, 612000, 2), fin("b3", 10, 615000, 3)]},
                     penalties=list(penalties))


class FinalsAndPenalties(unittest.TestCase):
    def order(self, ev):
        return [c.driver_id for c in classify_event(ev) if c.overall_pos]

    def test_no_penalty_blocks(self):
        self.assertEqual(self.order(race_day()), ["a1", "a2", "a3", "a4", "b1", "b2", "b3"])

    def test_time_penalty_within_final(self):
        ev = race_day([Penalty("a2", TIME, 5, "A")])  # 602 + 5 = 607 > 605
        self.assertEqual(self.order(ev)[:4], ["a1", "a3", "a2", "a4"])
        ev = race_day([Penalty("a2", TIME, 2, "A")])  # 604 < 605 -> no change
        self.assertEqual(self.order(ev)[:4], ["a1", "a2", "a3", "a4"])

    def test_time_penalty_never_below_lapped_or_into_b(self):
        ev = race_day([Penalty("a2", TIME, 60, "A")])
        self.assertEqual(self.order(ev), ["a1", "a3", "a2", "a4", "b1", "b2", "b3"])

    def test_dnf_stays_above_b_winner(self):
        ev = race_day()
        ev.finals["A"][0] = Entry("a1", DNF, 3, None, 49000, None, 4)
        self.assertEqual(self.order(ev)[:5], ["a2", "a3", "a4", "a1", "b1"])

    def test_dsq_everyone_moves_up_across_border(self):
        ev = race_day([Penalty("a1", DSQ_PEN)])
        cls = classify_event(ev)
        pos = {c.driver_id: c.overall_pos for c in cls}
        self.assertEqual(pos["b1"], 4)  # was P5
        self.assertIsNone(pos["a1"])
        self.assertEqual(cls[-1].status, DSQ)
        pts = event_points(ev, SCHEME)
        self.assertTrue(pts["a1"].dsq)
        self.assertEqual(pts["a1"].total, 0)
        self.assertEqual(pts["a2"].pole, 1, "pole passes to next driver")
        self.assertEqual(pts["a2"].quali, 3)

    def test_penalty_validation(self):
        with self.assertRaises(ValueError):
            classify_event(race_day([Penalty("b1", TIME, 5, "A")]))

    def test_points_and_overall_fastest_lap_from_b_final(self):
        pts = event_points(race_day(), SCHEME)
        self.assertEqual(pts["a1"].race, 25)
        self.assertEqual(pts["b1"].race, 10)  # P5 overall
        self.assertEqual(pts["b1"].fastest_lap, 1)  # 48.5 in B final beats 49.0 in A
        self.assertEqual(pts["a1"].pole + pts["a1"].quali, 4)


# ====================================================================== standings, teams, tags
class Standings(unittest.TestCase):
    def test_drop_round_and_countback(self):
        e1 = EventData("e1", 1, finals={"A": [fin("x", 10, 1, 1), fin("y", 10, 2, 2)]})
        e2 = EventData("e2", 2, finals={"A": [fin("y", 10, 1, 1), fin("x", 10, 2, 2)]})
        rows = season_standings([e1, e2], PointsScheme([25, 18], fastest_lap_bonus=0))
        self.assertEqual([(r.driver_id, r.points) for r in rows], [("y", 43), ("x", 43)])  # tie -> latest result
        rows = season_standings([e1, e2], PointsScheme([25, 18], drop_rounds=1))
        self.assertEqual({r.driver_id: r.points for r in rows}, {"x": 25, "y": 25})

    def test_team_with_reserve(self):
        ev1, ev2 = race_day(), race_day()
        ev2.event_id, ev2.sequence = "e2", 2
        entries = {"e1": {"a1": "T1", "b3": "T1", "a2": "T2"},
                   "e2": {"a1": "T1", "a2": "T2", "b2": "T2"}}  # b3 reserve for T1 in e1, b2 for T2 in e2
        teams = dict((t, pts) for t, _, pts in team_standings([ev1, ev2], PointsScheme([25, 18, 15, 12, 10, 8, 6]),
                                                              entries))
        self.assertEqual(teams["T1"], 25 + 6 + 25)
        self.assertEqual(teams["T2"], 18 + 18 + 8)

    def test_tag_filter(self):
        ev = EventData("e1", 1, finals={"A": [fin(f"d{i:02d}", 10, 600000 + i, i) for i in range(1, 11)]})
        standings = season_standings([ev], SCHEME)
        heavy = {"d03", "d07", "d10"}  # 95kg+
        rows = filter_by_tags(standings, heavy)
        self.assertEqual([(r.driver_id, r.tag_pos, r.pos) for r in rows], [("d03", 1, 3), ("d07", 2, 7), ("d10", 3, 10)])
        self.assertEqual(rows[0].points, 15, "points unchanged")
        cls = filter_by_tags(classify_event(ev), heavy, pos_attr="overall_pos")
        self.assertEqual([c.tag_pos for c in cls], [1, 2, 3])


# ====================================================================== licence
def season(pen_by_event, absent=()):
    evs = []
    for i, pen in enumerate(pen_by_event, start=1):
        racers = [] if f"e{i}" in absent else [fin("drv", 10, 600000, 1)]
        pens = [Penalty("drv", TIME, pen, "A")] if pen else []
        evs.append(EventData(f"e{i}", i, finals={"A": racers}, penalties=pens if racers else []))
    return evs


class Licence(unittest.TestCase):
    def test_plan_walkthrough(self):
        rows = driver_ledger(season([6, 0, 5, 0, 0], absent={"e4"}), "drv")
        self.assertEqual([r.balance for r in rows], [6, 5.5, 10.5, 5.25, 4.75])
        self.assertTrue(rows[2].banned_next)
        self.assertTrue(rows[3].served_ban)
        self.assertFalse(rows[3].ban_violated)

    def test_late_penalty_flags_violation(self):
        rows = driver_ledger(season([10, 0]), "drv")  # driver already raced e2 when e1 penalty entered
        self.assertTrue(rows[1].served_ban)
        self.assertTrue(rows[1].ban_violated)

    def test_absent_no_decay_floor_zero_dsq_no_points(self):
        rows = driver_ledger(season([1, 0, 0, 0], absent={"e3"}), "drv")
        self.assertEqual([r.balance for r in rows], [1, 0.5, 0.5, 0])
        ev = EventData("e1", 1, finals={"A": [fin("drv", 10, 1, 1)]}, penalties=[Penalty("drv", DSQ_PEN)])
        row = driver_ledger([ev], "drv")[0]
        self.assertEqual((row.balance, row.decay), (0, 0), "DSQ = 0 points and no clean-race decay")

    def test_rules_configurable(self):
        rows = driver_ledger(season([4]), "drv", LicenceRules(ban_threshold=4))
        self.assertTrue(rows[0].banned_next)


if __name__ == "__main__":
    unittest.main()
