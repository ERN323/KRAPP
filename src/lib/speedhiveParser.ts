import { LeagueMemberItem } from './leaguesRepo'

export type SessionResultStatus = 'FIN' | 'DNF' | 'DNS' | 'DSQ'

export interface ParsedSessionRow {
  rowId: string
  posInSession: number | null
  startNumber: string
  rawCompetitorName: string
  matchedDriverId: string | null // UUID of league member, or null for "+ Auto-Create / Guest"
  className: string
  status: SessionResultStatus
  laps: number | null
  totalTimeText: string
  totalTimeMs: number | null
  diffText: string
  gapMs: number | null
  gapLaps: number | null
  bestLapText: string
  bestLapMs: number | null
  secondBestLapText: string
  secondBestLapMs: number | null
  bestLapNo: number | null
  bestSpeedKmh: number | null
  raw: Record<string, string>
}

export interface ParsedSpeedhiveResult {
  detectedKind: 'QUALI' | 'FINAL'
  headers: string[]
  rows: ParsedSessionRow[]
  warnings: string[]
}

const HEADER_MAP: Record<string, string> = {
  pos: 'pos',
  position: 'pos',
  'start number': 'start_number',
  'kart': 'start_number',
  'no.': 'start_number',
  'number': 'start_number',
  competitor: 'competitor',
  'driver id': 'competitor',
  name: 'competitor',
  driver: 'competitor',
  class: 'class_',
  'total time': 'total_time',
  time: 'total_time',
  diff: 'diff',
  gap: 'diff',
  laps: 'laps',
  'best lap': 'best_lap',
  'best time': 'best_lap',
  '2nd best lap': 'second_best_lap',
  'second best lap': 'second_best_lap',
  'best lap no.': 'best_lap_no',
  'best lap no': 'best_lap_no',
  'best speed': 'best_speed',
}

const NULL_TOKENS = new Set(['', '-', '--', 'n/a'])
const STATUS_WORDS: Record<string, SessionResultStatus> = {
  DNF: 'DNF',
  NC: 'DNF',
  DNS: 'DNS',
  DSQ: 'DSQ',
  DQ: 'DSQ',
  DISQ: 'DSQ',
}
const MPH_TO_KMH = 1.609344

export function normalizeTextForMatch(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function parseTimeMs(text?: string | null): {
  ms: number | null
  decimals: number | null
} {
  const t = (text || '').trim().replace(/^\+/, '').replace(',', '.')
  if (NULL_TOKENS.has(t.toLowerCase())) {
    return { ms: null, decimals: null }
  }
  const parts = t.split(':')
  if (parts.length > 3) {
    return { ms: null, decimals: null }
  }
  const secPart = parts[parts.length - 1]
  const secNum = parseFloat(secPart)
  if (Number.isNaN(secNum)) {
    return { ms: null, decimals: null }
  }
  const decimals = secPart.includes('.')
    ? secPart.split('.')[1]?.length ?? 0
    : 0
  const minutes =
    parts.length >= 2 ? parseInt(parts[parts.length - 2], 10) || 0 : 0
  const hours = parts.length === 3 ? parseInt(parts[0], 10) || 0 : 0
  const ms = Math.round((hours * 3600 + minutes * 60 + secNum) * 1000)
  if (ms <= 0) {
    return { ms: null, decimals: null }
  }
  return { ms, decimals }
}

export function formatMsToLapText(ms?: number | null): string {
  if (!ms || ms <= 0) return ''
  const minutes = Math.floor(ms / 60000)
  const remSec = (ms % 60000) / 1000
  if (minutes > 0) {
    const secStr = remSec < 10 ? `0${remSec.toFixed(3)}` : remSec.toFixed(3)
    return `${minutes}:${secStr}`
  }
  return remSec.toFixed(3)
}

export function formatMsToTotalText(ms?: number | null): string {
  if (!ms || ms <= 0) return ''
  const minutes = Math.floor(ms / 60000)
  const remSec = (ms % 60000) / 1000
  const minStr = String(minutes).padStart(2, '0')
  const secStr = remSec < 10 ? `0${remSec.toFixed(3)}` : remSec.toFixed(3)
  return `${minStr}:${secStr}`
}

export function parseDiffValue(text?: string | null): {
  gapMs: number | null
  gapLaps: number | null
  statusWord: SessionResultStatus | null
} {
  const t = (text || '').trim()
  const upper = t.toUpperCase()
  if (STATUS_WORDS[upper]) {
    return { gapMs: null, gapLaps: null, statusWord: STATUS_WORDS[upper] }
  }
  const lapMatch = t.match(/^\+?(\d+)\s*laps?$/i)
  if (lapMatch) {
    return {
      gapMs: null,
      gapLaps: parseInt(lapMatch[1], 10),
      statusWord: null,
    }
  }
  if (NULL_TOKENS.has(t.toLowerCase())) {
    return { gapMs: null, gapLaps: null, statusWord: null }
  }
  const t2 = t.replace(/^\+/, '').replace(',', '.')
  if (/^0+(\.0+)?$/.test(t2)) {
    return { gapMs: 0, gapLaps: null, statusWord: null }
  }
  const { ms } = parseTimeMs(t2)
  return { gapMs: ms, gapLaps: null, statusWord: null }
}

export function parseSpeedKmh(text?: string | null): number | null {
  const t = (text || '').trim()
  if (NULL_TOKENS.has(t.toLowerCase())) return null
  const m = t.match(/^([\d.,]+)\s*(km\/h|kph|mph)?$/i)
  if (!m) return null
  let val = parseFloat(m[1].replace(',', '.'))
  if (Number.isNaN(val) || val <= 0) return null
  if ((m[2] || '').toLowerCase() === 'mph') {
    val *= MPH_TO_KMH
  }
  return Math.round(val * 1000) / 1000
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

export function buildMemberTrackDriverId(
  member: LeagueMemberItem,
  idx = 0
): string {
  let first = (member.firstName || '').trim()
  let last = (member.surname || '').trim()
  if (!first && !last) {
    const parts = (member.displayName || member.handle.replace(/^@/, ''))
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    first = parts[0] || 'Driver'
    last = parts.slice(1).join(' ')
  }
  const num = (member.driverNumber || '').trim() || String(idx + 1)
  if (first && last) {
    const capLast = last.charAt(0).toUpperCase() + last.slice(1)
    return `${first.charAt(0).toUpperCase()}.${capLast} - ${num}`
  }
  return `${first || last || 'Driver'} - ${num}`
}

export function matchCompetitorToLeagueMember(
  rawCompetitor: string,
  startNumber: string | null,
  members: LeagueMemberItem[],
  aliases: { aliasNorm: string; driverId: string }[] = []
): string | null {
  const cleanRaw = (rawCompetitor || '').trim()
  if (!cleanRaw) return null

  const normComp = normalizeTextForMatch(cleanRaw)
  const lowerCollapsed = cleanRaw.toLowerCase().replace(/\s+/g, ' ').trim()

  // 1. Check saved `driver_aliases` first
  const aliasHit = aliases.find(
    (a) =>
      a.aliasNorm === lowerCollapsed ||
      normalizeTextForMatch(a.aliasNorm) === normComp
  )
  if (aliasHit && members.some((m) => m.driverId === aliasHit.driverId)) {
    return aliasHit.driverId
  }

  // 2. Exact match on Track `Driver ID` ("E.Adlers - 33") or full name + number
  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    const trackId = buildMemberTrackDriverId(m, i)
    if (normalizeTextForMatch(trackId) === normComp) {
      return m.driverId
    }
    const fullName = `${m.firstName} ${m.surname}`.trim() || m.displayName
    const fullWithNum = `${fullName} ${m.driverNumber}`.trim()
    if (
      normalizeTextForMatch(fullName) === normComp ||
      normalizeTextForMatch(fullWithNum) === normComp ||
      normalizeTextForMatch(m.displayName) === normComp ||
      normalizeTextForMatch(m.handle.replace(/^@/, '')) === normComp
    ) {
      return m.driverId
    }
  }

  // 3. Parse pattern like "E.Adlers - 33" or "E. Adlers 33" (Initial + Surname + Number)
  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    const mFirst = normalizeTextForMatch(m.firstName)
    const mLast = normalizeTextForMatch(m.surname)
    const mNum = (m.driverNumber || '').trim()

    if (mLast && normComp.includes(mLast)) {
      if (!mNum || normComp.includes(mNum) || startNumber === mNum) {
        return m.driverId
      }
      if (mFirst && normComp.startsWith(mFirst.charAt(0))) {
        return m.driverId
      }
    }
  }

  // 4. Match by driver number if unique in the league and mentioned in the competitor string
  for (const m of members) {
    const mNum = (m.driverNumber || '').trim()
    if (mNum && mNum.length >= 1) {
      const trailingNumMatch = cleanRaw.match(/-\s*(\d+)\s*$/)
      if (trailingNumMatch && trailingNumMatch[1] === mNum) {
        return m.driverId
      }
    }
  }

  return null
}

export function parseSpeedhiveCsvText(
  csvText: string,
  members: LeagueMemberItem[],
  aliases: { aliasNorm: string; driverId: string }[] = [],
  expectedKind?: 'QUALI' | 'FINAL'
): ParsedSpeedhiveResult {
  const warnings: string[] = []
  const cleanText = csvText.replace(/^\uFEFF/, '')
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error('The CSV file is empty.')
  }

  // Detect delimiter (',' vs ';' vs '\t')
  const firstLine = lines[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const semiCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  const delimiter =
    semiCount > commaCount && semiCount >= tabCount
      ? ';'
      : tabCount > commaCount
        ? '\t'
        : ','

  const headers = parseCsvLine(lines[0], delimiter)
  const colIndex: Record<string, number> = {}
  headers.forEach((h, idx) => {
    const canon = HEADER_MAP[h.toLowerCase().trim()]
    if (canon && colIndex[canon] === undefined) {
      colIndex[canon] = idx
    }
  })

  if (colIndex.competitor === undefined) {
    throw new Error(
      `Missing "Competitor" (or "Driver ID") column. Found headers: ${headers.join(', ')}`
    )
  }

  const detectedKind: 'QUALI' | 'FINAL' =
    colIndex.total_time !== undefined ? 'FINAL' : 'QUALI'

  if (expectedKind && expectedKind !== detectedKind) {
    warnings.push(
      `Selected ${expectedKind === 'QUALI' ? 'QUALY' : 'RACE'} mode, but CSV headers look like ${
        detectedKind === 'QUALI' ? 'Qualifying (no Total Time column)' : 'Race Final (has Total Time column)'
      }.`
    )
  }

  const rows: ParsedSessionRow[] = []
  let minTotalDec: number | null = null

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter)
    if (cells.every((c) => !c.trim())) continue

    const getCell = (canon: string): string => {
      const idx = colIndex[canon]
      return idx !== undefined && idx < cells.length ? cells[idx].trim() : ''
    }

    const posRaw = getCell('pos')
    const statusFromPos = STATUS_WORDS[posRaw.toUpperCase()] || null
    const parsedPos = statusFromPos
      ? null
      : parseInt(posRaw, 10) || rows.length + 1

    const startNumber = getCell('start_number')
    const rawCompetitorName = getCell('competitor') || `Driver ${rows.length + 1}`
    const className = getCell('class_')
    const lapsRaw = getCell('laps')
    const laps = NULL_TOKENS.has(lapsRaw.toLowerCase())
      ? null
      : parseInt(lapsRaw, 10)

    const { ms: totalTimeMs, decimals: totalDec } = parseTimeMs(
      getCell('total_time')
    )
    if (totalDec !== null) {
      minTotalDec =
        minTotalDec === null ? totalDec : Math.min(minTotalDec, totalDec)
    }

    const diffRaw = getCell('diff')
    const { gapMs, gapLaps, statusWord: diffStatus } = parseDiffValue(diffRaw)

    const { ms: bestLapMs } = parseTimeMs(getCell('best_lap'))
    const { ms: secondBestLapMs } = parseTimeMs(getCell('second_best_lap'))
    const bestLapNoRaw = getCell('best_lap_no')
    const bestLapNo = NULL_TOKENS.has(bestLapNoRaw.toLowerCase())
      ? null
      : parseInt(bestLapNoRaw, 10) || null
    const bestSpeedKmh = parseSpeedKmh(getCell('best_speed'))

    const status: SessionResultStatus =
      statusFromPos ||
      diffStatus ||
      (!laps || laps <= 0 ? 'DNS' : 'FIN')

    const matchedDriverId = matchCompetitorToLeagueMember(
      rawCompetitorName,
      startNumber || null,
      members,
      aliases
    )

    const rawMap: Record<string, string> = {}
    headers.forEach((h, hIdx) => {
      rawMap[h] = cells[hIdx] ?? ''
    })

    rows.push({
      rowId: `row-${i}-${Math.random().toString(36).slice(2, 7)}`,
      posInSession: parsedPos,
      startNumber,
      rawCompetitorName,
      matchedDriverId,
      className,
      status,
      laps: Number.isNaN(laps as number) ? null : laps,
      totalTimeText: formatMsToTotalText(totalTimeMs) || getCell('total_time'),
      totalTimeMs,
      diffText: diffRaw,
      gapMs: status === 'DNS' ? null : gapMs,
      gapLaps: status === 'DNS' ? null : gapLaps,
      bestLapText: formatMsToLapText(bestLapMs) || getCell('best_lap'),
      bestLapMs,
      secondBestLapText:
        formatMsToLapText(secondBestLapMs) || getCell('second_best_lap'),
      secondBestLapMs,
      bestLapNo,
      bestSpeedKmh,
      raw: rawMap,
    })
  }

  if (minTotalDec !== null && minTotalDec < 3) {
    warnings.push(
      `Total Time has only ${minTotalDec} decimal place(s) — file may have been re-saved in Excel.`
    )
  }

  const unmatchedCount = rows.filter((r) => !r.matchedDriverId).length
  if (unmatchedCount > 0) {
    warnings.push(
      `${unmatchedCount} row(s) did not match an existing league member automatically. Pick a member in the dropdown or leave as Guest Driver.`
    )
  }

  return {
    detectedKind,
    headers,
    rows,
    warnings,
  }
}

// Divide racers randomly into equal-sized Qualy heats where no heat exceeds maxKartsPerHeat
export interface QualyHeatGroup {
  batchNo: number
  racers: LeagueMemberItem[]
}

export function generateRandomQualyHeats(
  racers: LeagueMemberItem[],
  maxKartsPerHeat: number
): QualyHeatGroup[] {
  const safeMax = Math.max(1, maxKartsPerHeat || 12)
  if (racers.length === 0) return []

  // Fisher-Yates shuffle
  const shuffled = [...racers]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = tmp
  }

  const numHeats = Math.ceil(shuffled.length / safeMax)
  const baseSize = Math.floor(shuffled.length / numHeats)
  const remainder = shuffled.length % numHeats

  const heats: QualyHeatGroup[] = []
  let cursor = 0
  for (let h = 0; h < numHeats; h++) {
    const count = baseSize + (h < remainder ? 1 : 0)
    heats.push({
      batchNo: h + 1,
      racers: shuffled.slice(cursor, cursor + count),
    })
    cursor += count
  }

  return heats
}

// Compute Alphabetical Finals Split (Final A, Final B, Final C...) from Combined Quali Leaderboard
export interface CombinedQualiEntry {
  driverId: string
  displayName: string
  firstName: string
  surname: string
  driverNumber: string
  bestLapMs: number | null
  secondBestLapMs: number | null
  splitPos: number
  isDsq: boolean
}

export interface FinalGroupSplit {
  letter: string
  entries: (CombinedQualiEntry & { gridPosInFinal: number })[]
}

export function computeAlphabeticalFinalsSplit(
  combinedQuali: CombinedQualiEntry[],
  maxKartsPerFinal: number
): FinalGroupSplit[] {
  const safeMax = Math.max(1, maxKartsPerFinal || 12)
  const eligible = combinedQuali.filter((q) => !q.isDsq)
  if (eligible.length === 0) return []

  const numFinals = Math.ceil(eligible.length / safeMax)
  const finals: FinalGroupSplit[] = []

  for (let f = 0; f < numFinals; f++) {
    const letter = String.fromCharCode(65 + f) // 'A', 'B', 'C', 'D'...
    const slice = eligible.slice(f * safeMax, (f + 1) * safeMax)
    finals.push({
      letter,
      entries: slice.map((entry, idx) => ({
        ...entry,
        gridPosInFinal: idx + 1,
      })),
    })
  }

  return finals
}
