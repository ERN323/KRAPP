"""Parse SpeedHive (MYLAPS) result CSV exports into normalised rows.

Handles the data flags D1-D9 from docs/results-strategy.md:
- columns mapped by header name (Quali has no 'Total Time', Race has it mid-file)
- times -> integer milliseconds; '0' / '-' / '' -> None
- 'Best Speed' '70.951 km/h' -> float km/h (mph converted)
- 'Diff' '1 Lap' -> gap_laps, '3.628' -> gap_ms, 'DNF' -> status
- status FIN / DNF / DNS / DSQ derived (no laps -> DNS)
- delimiter (',' ';' tab), decimal comma, UTF-8 vs Windows-1257 detected
- precision warning when times have fewer than 3 decimals (file re-saved in Excel)

Stdlib only. The file's own 'Pos' is kept as pos_in_session: it is local to one batch/final.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

QUALI, FINAL = "QUALI", "FINAL"
FIN, DNF, DNS, DSQ = "FIN", "DNF", "DNS", "DSQ"

# lower-cased SpeedHive header -> canonical field name
HEADER_MAP = {
    "pos": "pos",
    "position": "pos",
    "start number": "start_number",
    "competitor": "competitor",
    "name": "competitor",
    "driver": "competitor",
    "class": "class_",
    "total time": "total_time",
    "diff": "diff",
    "gap": "diff",
    "laps": "laps",
    "best lap": "best_lap",
    "2nd best lap": "second_best_lap",
    "second best lap": "second_best_lap",
    "best lap no.": "best_lap_no",
    "best speed": "best_speed",
}
REQUIRED = {"pos", "competitor", "laps", "best_lap"}
NULL_TOKENS = {"", "-", "--", "n/a"}
STATUS_WORDS = {"DNF": DNF, "NC": DNF, "DNS": DNS, "DSQ": DSQ, "DQ": DSQ, "DISQ": DSQ}
MPH_TO_KMH = 1.609344


@dataclass
class ResultRow:
    pos_in_session: int | None
    start_number: str | None
    competitor: str
    competitor_norm: str
    class_: str | None
    status: str
    laps: int | None
    total_time_ms: int | None
    gap_ms: int | None
    gap_laps: int | None
    best_lap_ms: int | None
    second_best_lap_ms: int | None
    best_lap_no: int | None
    best_speed_kmh: float | None
    raw: dict[str, str] = field(default_factory=dict)  # original header -> original string


@dataclass
class ParsedFile:
    kind: str  # QUALI | FINAL (detected from headers)
    headers: list[str]
    rows: list[ResultRow]
    warnings: list[str]
    sha256: str
    encoding: str
    delimiter: str


# ---------------------------------------------------------------- value parsers
def _clean(text: str | None) -> str:
    return (text or "").strip()


def parse_time_ms(text: str | None) -> tuple[int | None, int | None]:
    """'53.378' -> (53378, 3); '08:03.9' -> (483900, 1); '1:02:03,456' -> (3723456, 3).
    '0', '-', '' -> (None, None). Returns (milliseconds, number of decimals in the source)."""
    t = _clean(text).lstrip("+").replace(",", ".")
    if t.lower() in NULL_TOKENS:
        return None, None
    parts = t.split(":")
    if len(parts) > 3:
        raise ValueError(f"unrecognised time: {text!r}")
    sec_part = parts[-1]
    decimals = len(sec_part.split(".")[1]) if "." in sec_part else 0
    seconds = float(sec_part)
    minutes = int(parts[-2]) if len(parts) >= 2 else 0
    hours = int(parts[-3]) if len(parts) == 3 else 0
    ms = round((hours * 3600 + minutes * 60 + seconds) * 1000)
    if ms == 0:
        return None, None
    return ms, decimals


def parse_diff(text: str | None) -> tuple[int | None, int | None, str | None]:
    """-> (gap_ms, gap_laps, status_word). '0' = leader (gap 0 ms)."""
    t = _clean(text)
    if t.upper() in STATUS_WORDS:
        return None, None, STATUS_WORDS[t.upper()]
    m = re.fullmatch(r"\+?(\d+)\s*laps?", t, flags=re.IGNORECASE)
    if m:
        return None, int(m.group(1)), None
    if t.lower() in NULL_TOKENS:
        return None, None, None
    t2 = t.lstrip("+").replace(",", ".")
    if re.fullmatch(r"0+(\.0+)?", t2):
        return 0, None, None
    ms, _ = parse_time_ms(t2)
    return ms, None, None


def parse_speed_kmh(text: str | None) -> float | None:
    t = _clean(text)
    if t.lower() in NULL_TOKENS:
        return None
    m = re.fullmatch(r"([\d.,]+)\s*(km/h|kph|mph)?", t, flags=re.IGNORECASE)
    if not m:
        raise ValueError(f"unrecognised speed: {text!r}")
    value = float(m.group(1).replace(",", "."))
    if value == 0:
        return None
    if (m.group(2) or "").lower() == "mph":
        value *= MPH_TO_KMH
    return round(value, 3)


def parse_int(text: str | None) -> int | None:
    t = _clean(text)
    if t.lower() in NULL_TOKENS:
        return None
    return int(float(t.replace(",", ".")))


def normalise_name(name: str) -> str:
    """'  Jānis  BĒRZIŅŠ ' -> 'janis berzins'. Used as the alias lookup key."""
    decomposed = unicodedata.normalize("NFKD", name)
    no_marks = "".join(c for c in decomposed if not unicodedata.combining(c))
    cleaned = re.sub(r"[^\w\s-]", " ", no_marks.casefold())
    return re.sub(r"\s+", " ", cleaned).strip()


def make_handle(name: str, taken: set[str] | None = None) -> str:
    """Default handle for a new/guest driver: '@troy-bowden', '@troy-bowden-2' if taken."""
    base = "@" + normalise_name(name).replace(" ", "-")
    taken = taken or set()
    handle, n = base, 1
    while handle in taken:
        n += 1
        handle = f"{base}-{n}"
    return handle


# ---------------------------------------------------------------- file parser
def _decode(data: bytes) -> tuple[str, str]:
    try:
        return data.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        return data.decode("cp1257"), "cp1257"


def _detect_delimiter(first_line: str) -> str:
    counts = {d: first_line.count(d) for d in (",", ";", "\t")}
    return max(counts, key=lambda d: counts[d]) if max(counts.values()) else ","


def parse_bytes(data: bytes, expected_kind: str | None = None) -> ParsedFile:
    text, encoding = _decode(data)
    warnings: list[str] = []
    if encoding != "utf-8":
        warnings.append(f"File is not UTF-8; decoded as {encoding}. Check names with diacritics.")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise ValueError("empty file")
    delimiter = _detect_delimiter(lines[0])
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    headers = [h.strip() for h in next(reader)]

    col: dict[str, int] = {}
    for i, h in enumerate(headers):
        canon = HEADER_MAP.get(h.lower())
        if canon is None:
            warnings.append(f"Unknown column '{h}' kept in raw data only.")
        elif canon not in col:
            col[canon] = i
    missing = REQUIRED - col.keys()
    if missing:
        raise ValueError(f"missing required column(s): {sorted(missing)}; headers were {headers}")

    kind = FINAL if "total_time" in col else QUALI
    if expected_kind and expected_kind != kind:
        warnings.append(
            f"Uploaded as {expected_kind} but headers look like {kind} "
            f"({'has' if kind == FINAL else 'no'} 'Total Time' column)."
        )

    def get(cells: list[str], name: str) -> str | None:
        i = col.get(name)
        return cells[i] if i is not None and i < len(cells) else None

    rows: list[ResultRow] = []
    min_total_dec: int | None = None
    for line_no, cells in enumerate(reader, start=2):
        if not any(c.strip() for c in cells):
            continue
        try:
            pos_raw = _clean(get(cells, "pos"))
            status_word = STATUS_WORDS.get(pos_raw.upper())
            pos = None if status_word else parse_int(pos_raw)
            gap_ms, gap_laps, diff_status = parse_diff(get(cells, "diff"))
            laps = parse_int(get(cells, "laps"))
            total_ms, total_dec = parse_time_ms(get(cells, "total_time"))
            best_ms, _ = parse_time_ms(get(cells, "best_lap"))
            second_ms, _ = parse_time_ms(get(cells, "second_best_lap"))
            status = status_word or diff_status or (DNS if not laps else FIN)
            if status == DNS:
                gap_ms = gap_laps = None
            if total_dec is not None:
                min_total_dec = total_dec if min_total_dec is None else min(min_total_dec, total_dec)
            competitor = _clean(get(cells, "competitor"))
            rows.append(
                ResultRow(
                    pos_in_session=pos,
                    start_number=_clean(get(cells, "start_number")) or None,
                    competitor=competitor,
                    competitor_norm=normalise_name(competitor),
                    class_=_clean(get(cells, "class_")) or None,
                    status=status,
                    laps=laps,
                    total_time_ms=total_ms,
                    gap_ms=gap_ms,
                    gap_laps=gap_laps,
                    best_lap_ms=best_ms,
                    second_best_lap_ms=second_ms,
                    best_lap_no=parse_int(get(cells, "best_lap_no")),
                    best_speed_kmh=parse_speed_kmh(get(cells, "best_speed")),
                    raw={h: (cells[i] if i < len(cells) else "") for i, h in enumerate(headers)},
                )
            )
        except ValueError as exc:
            raise ValueError(f"line {line_no}: {exc}") from exc

    if min_total_dec is not None and min_total_dec < 3:
        warnings.append(
            f"'Total Time' has only {min_total_dec} decimal(s) (e.g. 08:03.9). SpeedHive exports milliseconds; "
            "the file was probably opened/saved in Excel. Ask the track for the raw export."
        )
    if "second_best_lap" not in col and kind == QUALI:
        warnings.append("No 2nd-best-lap column: quali ties cannot be broken automatically (open item O1).")
    if len({r.competitor_norm for r in rows}) != len(rows):
        warnings.append("The same competitor name appears twice in this file.")

    return ParsedFile(
        kind=kind,
        headers=headers,
        rows=rows,
        warnings=warnings,
        sha256=hashlib.sha256(data).hexdigest(),
        encoding=encoding,
        delimiter=delimiter,
    )


def parse_file(path: str | Path, expected_kind: str | None = None) -> ParsedFile:
    return parse_bytes(Path(path).read_bytes(), expected_kind)
