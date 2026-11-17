import React, { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Camera,
  Check,
  CheckCircle2,
  AlertTriangle,
  Shuffle,
  Download,
  Plus,
  Trash2,
  ChevronDown,
  Flag,
  Users,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'
import { TrackDayHeader } from './TrackDayTheme'
import {
  League,
  LeagueMemberItem,
  LeagueRaceEvent,
  LeagueTeam,
  EventUploadState,
  fetchEventUploadStateInSupabase,
  uploadSessionResultsInSupabase,
} from '../lib/leaguesRepo'
import {
  ParsedSessionRow,
  SessionResultStatus,
  decodeCsvFileBuffer,
  parseSpeedhiveCsvText,
  parseTimeMs,
  buildMemberTrackDriverId,
  generateRandomQualyHeats,
  computeAlphabeticalFinalsSplit,
  formatMsToLapText,
  QualyHeatGroup,
} from '../lib/speedhiveParser'

interface UploadRaceResultsScreenProps {
  league: League
  members: LeagueMemberItem[]
  teams: LeagueTeam[]
  events: LeagueRaceEvent[]
  unreadNotificationsCount: number
  onBack: () => void
  onBellClick: () => void
  onScheduleNewRace: () => void
  onResultsPublished: () => Promise<void>
}

export const UploadRaceResultsScreen: React.FC<UploadRaceResultsScreenProps> = ({
  league,
  members,
  teams,
  events,
  unreadNotificationsCount,
  onBack,
  onBellClick,
  onScheduleNewRace,
  onResultsPublished,
}) => {
  // 1. Mode: 'QUALY' or 'RACE' (Finals) — Only these two choices!
  const [uploadMode, setUploadMode] = useState<'QUALY' | 'RACE'>('QUALY')

  // 2. Selected Scheduled Race (`DATE` in wireframe)
  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => events[0]?.id || ''
  )
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false)

  // 3. RACER COUNT / Available Karts per Heat (no upper limit, defaults to 12)
  const [maxKartsPerHeat, setMaxKartsPerHeat] = useState<string>('12')

  // 4. Event Upload State from Supabase (Combined Quali & saved driver aliases)
  const [eventUploadState, setEventUploadState] = useState<EventUploadState>({
    uploadedSessions: [],
    combinedQuali: [],
    aliases: [],
  })
  const [loadingEventState, setLoadingEventState] = useState(false)

  // 5. Qualy Randomizer & Finals Grid Helpers
  const [showQualyRandomizer, setShowQualyRandomizer] = useState(false)
  const [randomizedHeats, setRandomizedHeats] = useState<QualyHeatGroup[]>([])
  const [showFinalsSplit, setShowFinalsSplit] = useState(false)

  // 6. Parsed / Editable Rows for Validation before upload (auto-sorted!)
  const [parsedRows, setParsedRows] = useState<ParsedSessionRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([])
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isScanningPhoto, setIsScanningPhoto] = useState(false)

  // 7. Submission State
  const [isPublishing, setIsPublishing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const csvInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id)
    }
  }, [events, selectedEventId])

  const selectedEvent =
    events.find((e) => e.id === selectedEventId) || events[0] || null

  const refreshEventState = async (eventId: string) => {
    if (!eventId) return
    setLoadingEventState(true)
    try {
      const st = await fetchEventUploadStateInSupabase(eventId)
      setEventUploadState(st)
    } finally {
      setLoadingEventState(false)
    }
  }

  useEffect(() => {
    if (selectedEvent?.id) {
      refreshEventState(selectedEvent.id)
    }
  }, [selectedEvent?.id])

  const parsedMaxKarts = Math.max(1, parseInt(maxKartsPerHeat, 10) || 12)

  // Compute Alphabetical Finals Split (A, B, C, D, E, F...) from Combined Qualifying
  const finalsSplitGroups = computeAlphabeticalFinalsSplit(
    eventUploadState.combinedQuali,
    parsedMaxKarts
  )

  // Automatically sort and merge rows by mode:
  // - QUALY: sorted by fastest `bestLapMs` ascending (DNS/null at bottom), keeping best lap if same driver appears in multiple files
  // - RACE: sorted by Final group letter (from Qualy rank) -> status (FIN, DNF, DNS, DSQ) -> laps desc -> totalTimeMs asc
  const sortAndMergeRows = (
    rowsToMerge: ParsedSessionRow[],
    mode: 'QUALY' | 'RACE'
  ): ParsedSessionRow[] => {
    const byKey = new Map<string, ParsedSessionRow>()
    for (const r of rowsToMerge) {
      const key =
        r.matchedDriverId ||
        r.rawCompetitorName.trim().toLowerCase() ||
        r.rowId
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, r)
      } else if (mode === 'QUALY') {
        // Keep faster bestLapMs
        const keepNew =
          r.bestLapMs != null &&
          (existing.bestLapMs == null || r.bestLapMs < existing.bestLapMs)
        byKey.set(key, keepNew ? r : existing)
      } else {
        byKey.set(key, r)
      }
    }

    const merged = Array.from(byKey.values())

    const getDriverFinalLetter = (r: ParsedSessionRow): string => {
      if (r.matchedDriverId) {
        const qEntry = eventUploadState.combinedQuali.find(
          (q) => q.driverId === r.matchedDriverId
        )
        if (qEntry && qEntry.splitPos > 0) {
          const idx = Math.min(
            25,
            Math.floor((qEntry.splitPos - 1) / parsedMaxKarts)
          )
          return String.fromCharCode(65 + idx)
        }
      }
      return 'A'
    }

    const statusOrder: Record<SessionResultStatus, number> = {
      FIN: 0,
      DNF: 1,
      DNS: 2,
      DSQ: 3,
    }

    if (mode === 'QUALY') {
      merged.sort((a, b) => {
        if (a.bestLapMs != null && b.bestLapMs != null) {
          return a.bestLapMs - b.bestLapMs
        }
        if (a.bestLapMs != null) return -1
        if (b.bestLapMs != null) return 1
        return (a.posInSession ?? 999) - (b.posInSession ?? 999)
      })
    } else {
      merged.sort((a, b) => {
        const letA = getDriverFinalLetter(a)
        const letB = getDriverFinalLetter(b)
        if (letA !== letB) return letA.localeCompare(letB)
        const stDiff = statusOrder[a.status] - statusOrder[b.status]
        if (stDiff !== 0) return stDiff
        const lapsA = a.laps ?? 0
        const lapsB = b.laps ?? 0
        if (lapsA !== lapsB) return lapsB - lapsA
        if (a.totalTimeMs != null && b.totalTimeMs != null) {
          return a.totalTimeMs - b.totalTimeMs
        }
        if (a.totalTimeMs != null) return -1
        if (b.totalTimeMs != null) return 1
        return (a.posInSession ?? 999) - (b.posInSession ?? 999)
      })
    }

    return merged.map((r, idx) => ({
      ...r,
      posInSession: idx + 1,
    }))
  }

  // Generate randomized equal Qualy heats (any number of heats needed)
  const handleRunQualyRandomizer = () => {
    const heats = generateRandomQualyHeats(members, parsedMaxKarts)
    setRandomizedHeats(heats)
    setShowQualyRandomizer(true)
  }

  const handleExportQualyHeatsCsv = () => {
    if (randomizedHeats.length === 0) return
    const header = 'Qualy Heat,Grid Pos,Name,Surname,Number,Team,Driver ID'
    const lines: string[] = [header]
    randomizedHeats.forEach((heat) => {
      heat.racers.forEach((m, idx) => {
        const teamName =
          m.teamName ||
          teams.find((t) => t.members.some((tm) => tm.driverId === m.driverId))
            ?.name ||
          ''
        const trackId = buildMemberTrackDriverId(m, idx)
        lines.push(
          `QUALY ${heat.batchNo},${idx + 1},"${m.firstName || m.displayName}","${m.surname || ''}","${m.driverNumber || idx + 1}","${teamName}","${trackId}"`
        )
      })
    })
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${league.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qualy_heats.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportFinalsGridCsv = () => {
    if (finalsSplitGroups.length === 0) return
    const header =
      'Final,Grid Pos,Qualy Pos,Driver,Number,Best Qualy Lap,Driver ID'
    const lines: string[] = [header]
    finalsSplitGroups.forEach((grp) => {
      grp.entries.forEach((e) => {
        const memberObj = members.find((m) => m.driverId === e.driverId)
        const trackId = memberObj
          ? buildMemberTrackDriverId(memberObj, e.gridPosInFinal - 1)
          : `${e.displayName} - ${e.driverNumber || e.gridPosInFinal}`
        lines.push(
          `FINAL ${grp.letter},${e.gridPosInFinal},${e.splitPos},"${e.displayName}","${e.driverNumber || ''}","${formatMsToLapText(e.bestLapMs)}","${trackId}"`
        )
      })
    })
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${league.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_finals_grid.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle SpeedHive CSV File Selection (supports selecting 1 or multiple CSV files at once!)
  const handleCsvFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    setErrorMsg('')
    setSuccessMsg('')
    setPhotoPreviewUrl(null)

    const files = Array.from(fileList)
    const expectedKind = uploadMode === 'QUALY' ? 'QUALI' : 'FINAL'
    const newRows: ParsedSessionRow[] = []
    const allWarnings: string[] = []
    const names: string[] = []

    try {
      for (const file of files) {
        names.push(file.name)
        const buf = await file.arrayBuffer()
        const text = decodeCsvFileBuffer(buf)
        const parsed = parseSpeedhiveCsvText(
          text,
          members,
          eventUploadState.aliases,
          expectedKind
        )
        newRows.push(...parsed.rows)
        allWarnings.push(...parsed.warnings)
      }

      const combinedRows = sortAndMergeRows(
        [...parsedRows, ...newRows],
        uploadMode
      )
      setParsedRows(combinedRows)
      setUploadedFileNames((prev) => Array.from(new Set([...prev, ...names])))
      setParseWarnings(Array.from(new Set(allWarnings)))
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not parse CSV file(s)'
      )
    }

    e.target.value = ''
  }

  // Handle Printed Timing Sheet Photo Selection (Camera / Image)
  const handlePhotoFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg('')
    setSuccessMsg('')
    setUploadedFileNames((prev) => Array.from(new Set([...prev, file.name])))

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null
      if (!dataUrl) return
      setPhotoPreviewUrl(dataUrl)

      const geminiKey = (
        import.meta.env.VITE_GEMINI_API_KEY as string | undefined
      )?.trim()

      if (geminiKey) {
        setIsScanningPhoto(true)
        try {
          const base64Data = dataUrl.split(',')[1] || ''
          const mimeType = file.type || 'image/jpeg'
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: 'Extract the karting race/qualifying timing sheet table from this photo into strict CSV format with header: Pos,Start Number,Competitor,Laps,Total Time,Diff,Best Lap,Best Speed. Output ONLY raw CSV lines, no markdown fences.',
                      },
                      {
                        inlineData: {
                          mimeType,
                          data: base64Data,
                        },
                      },
                    ],
                  },
                ],
              }),
            }
          )
          const json = await resp.json()
          const extractedCsv: string =
            json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const cleanedCsv = extractedCsv
            .replace(/^```[a-z]*\n?/i, '')
            .replace(/```$/i, '')
            .trim()
          if (cleanedCsv) {
            const expectedKind = uploadMode === 'QUALY' ? 'QUALI' : 'FINAL'
            const parsed = parseSpeedhiveCsvText(
              cleanedCsv,
              members,
              eventUploadState.aliases,
              expectedKind
            )
            setParsedRows(
              sortAndMergeRows([...parsedRows, ...parsed.rows], uploadMode)
            )
            setParseWarnings([
              'Scanned from printed sheet photo — review all rows and lap times below before clicking UPLOAD RESULT.',
              ...parsed.warnings,
            ])
            setIsScanningPhoto(false)
            return
          }
        } catch {
          // Fall back to interactive verification rows below
        }
        setIsScanningPhoto(false)
      }

      if (parsedRows.length === 0) {
        setParsedRows(
          members.map((m, idx) => {
            const trackId = buildMemberTrackDriverId(m, idx)
            return {
              rowId: `prefill-${idx}-${Date.now()}`,
              posInSession: idx + 1,
              startNumber: m.driverNumber || String(idx + 1),
              rawCompetitorName: trackId,
              matchedDriverId: m.driverId,
              className: '',
              status: 'FIN',
              laps: 8,
              totalTimeText: '',
              totalTimeMs: null,
              diffText: '',
              gapMs: null,
              gapLaps: null,
              bestLapText: '',
              bestLapMs: null,
              secondBestLapText: '',
              secondBestLapMs: null,
              bestLapNo: null,
              bestSpeedKmh: null,
              raw: {
                Pos: String(idx + 1),
                'Start Number': m.driverNumber || String(idx + 1),
                Competitor: trackId,
              },
            }
          })
        )
      }
      setParseWarnings([
        'Printed timing sheet photo attached! Review or enter the times from the photo in the validation table below before clicking UPLOAD RESULT.',
      ])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleUpdateRow = (
    rowId: string,
    patch: Partial<ParsedSessionRow>
  ) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r
        const next = { ...r, ...patch }
        if (patch.bestLapText !== undefined) {
          next.bestLapMs = parseTimeMs(patch.bestLapText).ms
        }
        if (patch.totalTimeText !== undefined) {
          next.totalTimeMs = parseTimeMs(patch.totalTimeText).ms
        }
        return next
      })
    )
  }

  const handleAddBlankRow = () => {
    const nextPos = parsedRows.length + 1
    setParsedRows((prev) => [
      ...prev,
      {
        rowId: `manual-${Date.now()}-${nextPos}`,
        posInSession: nextPos,
        startNumber: String(nextPos),
        rawCompetitorName: '',
        matchedDriverId: members[0]?.driverId || null,
        className: '',
        status: 'FIN',
        laps: 8,
        totalTimeText: '',
        totalTimeMs: null,
        diffText: '',
        gapMs: null,
        gapLaps: null,
        bestLapText: '',
        bestLapMs: null,
        secondBestLapText: '',
        secondBestLapMs: null,
        bestLapNo: null,
        bestSpeedKmh: null,
        raw: {},
      },
    ])
  }

  const handleRemoveRow = (rowId: string) => {
    setParsedRows((prev) => prev.filter((r) => r.rowId !== rowId))
  }

  // Publish Validated Results to Supabase (automatically assigns & sorts per racer!)
  const handleConfirmUploadResult = async () => {
    if (!selectedEvent) {
      setErrorMsg('Please select or schedule a race date first.')
      return
    }
    if (parsedRows.length === 0) {
      setErrorMsg(
        'Please add a SpeedHive CSV file or scan a timing sheet first.'
      )
      return
    }

    setIsPublishing(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const kindToUpload = uploadMode === 'QUALY' ? 'QUALI' : 'FINAL'
      const sortedRows = sortAndMergeRows(parsedRows, uploadMode)

      await uploadSessionResultsInSupabase({
        eventId: selectedEvent.id,
        kind: kindToUpload,
        batchNo: kindToUpload === 'QUALI' ? 1 : null,
        finalLetter: null, // Auto-detected per driver from Combined Qualy rank in SQL!
        maxKarts: parsedMaxKarts,
        rows: sortedRows.map((r, idx) => {
          const matchedMember = members.find(
            (m) => m.driverId === r.matchedDriverId
          )
          const compName =
            r.rawCompetitorName.trim() ||
            (matchedMember
              ? buildMemberTrackDriverId(matchedMember, idx)
              : `Driver ${idx + 1}`)
          return {
            driverId: r.matchedDriverId,
            rawCompetitorName: compName,
            posInSession: idx + 1,
            startNumber: r.startNumber,
            className: r.className,
            status: r.status,
            laps: r.laps,
            totalTimeMs: r.totalTimeMs,
            gapMs: r.gapMs,
            gapLaps: r.gapLaps,
            bestLapMs: r.bestLapMs,
            secondBestLapMs: r.secondBestLapMs,
            bestLapNo: r.bestLapNo,
            bestSpeedKmh: r.bestSpeedKmh,
            raw: {
              ...r.raw,
              Pos: String(idx + 1),
              'Start Number': r.startNumber,
              Competitor: compName,
              Laps: r.laps != null ? String(r.laps) : '-',
              'Total Time': r.totalTimeText || '',
              'Best Lap': r.bestLapText || '',
            },
          }
        }),
      })

      await refreshEventState(selectedEvent.id)
      await onResultsPublished()

      setSuccessMsg(
        `${uploadMode} results (${sortedRows.length} drivers) automatically sorted & uploaded to the database!`
      )
      setParsedRows([])
      setParseWarnings([])
      setUploadedFileNames([])
      setPhotoPreviewUrl(null)
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to upload session results to Supabase'
      )
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <TrackDayHeader
        sectionTitle={league.name}
        sectionSubtitle="UPLOAD RACE RESULTS"
        onBack={onBack}
        onBellClick={onBellClick}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-between gap-3.5 shadow-2xl">
        <div className="flex flex-col gap-3">
          {/* Top Title */}
          <h2 className="font-display font-extrabold text-xl tracking-wider text-[#FF6B00] uppercase text-center">
            UPLOAD RACE RESULTS
          </h2>

          {/* 1. RACE / QUALY MODE SELECTOR PILLS (Matching Wireframe — Only 2 choices!) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadMode('RACE')
                setErrorMsg('')
                setSuccessMsg('')
                if (parsedRows.length > 0) {
                  setParsedRows((prev) => sortAndMergeRows(prev, 'RACE'))
                }
              }}
              className={`h-11 rounded-full font-display font-extrabold text-base tracking-wider uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadMode === 'RACE'
                  ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/25'
                  : 'bg-[#14191E] hover:bg-[#192026] text-[#FF6B00] border border-[#2A323B]'
              }`}
            >
              <Flag className="w-4 h-4" />
              <span>RACE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUploadMode('QUALY')
                setErrorMsg('')
                setSuccessMsg('')
                if (parsedRows.length > 0) {
                  setParsedRows((prev) => sortAndMergeRows(prev, 'QUALY'))
                }
              }}
              className={`h-11 rounded-full font-display font-extrabold text-base tracking-wider uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadMode === 'QUALY'
                  ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/25'
                  : 'bg-[#14191E] hover:bg-[#192026] text-[#FF6B00] border border-[#2A323B]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>QUALY</span>
            </button>
          </div>

          {/* 2. DATE (SCHEDULED RACE PICKER PILL) */}
          <div className="relative w-full">
            {events.length === 0 ? (
              <button
                type="button"
                onClick={onScheduleNewRace}
                className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#FF6B00]/60 rounded-full h-11 px-5 flex items-center justify-center gap-2 text-[#FF6B00] font-display font-extrabold text-sm tracking-wider uppercase cursor-pointer"
              >
                + SCHEDULE A RACE FIRST
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsDateDropdownOpen((o) => !o)}
                  className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] focus:border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-between gap-2 shadow-inner cursor-pointer"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A99AD] shrink-0">
                    DATE:
                  </span>
                  <span className="font-display font-extrabold text-sm sm:text-base tracking-wider text-[#FF6B00] uppercase truncate">
                    {selectedEvent
                      ? `${selectedEvent.eventDate
                          .split('-')
                          .reverse()
                          .join('.')} · ${selectedEvent.name}`
                      : 'SELECT SCHEDULED RACE'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#FF6B00] shrink-0 transition-transform ${
                      isDateDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isDateDropdownOpen && (
                  <div className="mt-1.5 w-full bg-[#14191E] border-2 border-[#FF6B00]/70 rounded-2xl p-2 shadow-2xl z-30 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {events.map((ev) => {
                      const isSel = ev.id === selectedEvent?.id
                      const fmtDate = ev.eventDate
                        ? ev.eventDate.split('-').reverse().join('.')
                        : 'TBA'
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            setSelectedEventId(ev.id)
                            setIsDateDropdownOpen(false)
                          }}
                          className={`w-full text-left rounded-xl px-3.5 py-2 border transition cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white'
                              : 'bg-[#1C2228] hover:bg-[#242C35] border-[#2A323B] text-white'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase truncate">
                              {ev.name}
                            </span>
                            <span className="text-[10px] text-[#8A99AD]">
                              {fmtDate} · {ev.location} · CONFIG{' '}
                              {ev.trackConfig || 'A'}
                            </span>
                          </div>
                          {isSel && (
                            <Check className="w-4 h-4 text-[#FF6B00] shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 3. RACER COUNT PILL (No upper cap!) */}
          <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                RACER COUNT (KARTS PER HEAT)
              </span>
            </div>
            <input
              type="number"
              min={1}
              value={maxKartsPerHeat}
              onChange={(e) => setMaxKartsPerHeat(e.target.value)}
              className="w-20 bg-[#1C2228] border border-[#2A323B] rounded-full h-7 text-center font-display font-extrabold text-sm text-white focus:outline-none focus:border-[#FF6B00]"
            />
          </div>

          {/* 4. OPTIONAL HELPER BAR: QUALY RANDOMIZER OR FINALS A-Z GRID PREVIEW */}
          {uploadMode === 'QUALY' ? (
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRunQualyRandomizer}
                className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#38BDF8]/50 rounded-full h-9 px-4 flex items-center justify-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#38BDF8] cursor-pointer transition"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>
                  QUALY RANDOMIZER ({members.length} Racers →{' '}
                  {Math.max(1, Math.ceil(members.length / parsedMaxKarts))}{' '}
                  Equal Qualy Heats)
                </span>
              </button>

              {showQualyRandomizer && randomizedHeats.length > 0 && (
                <div className="bg-[#14191E] border border-[#38BDF8]/50 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-xs tracking-wider text-[#38BDF8] uppercase">
                      {randomizedHeats.length} QUALY RACES ({members.length}{' '}
                      Racers · Max {parsedMaxKarts} Karts)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRunQualyRandomizer}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#1C2228] border border-[#2A323B] text-[#FF6B00] cursor-pointer"
                      >
                        Re-Shuffle
                      </button>
                      <button
                        type="button"
                        onClick={handleExportQualyHeatsCsv}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#38BDF8] text-black flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-2.5 h-2.5" />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQualyRandomizer(false)}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#1C2228] text-[#8A99AD] cursor-pointer"
                      >
                        Hide
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {randomizedHeats.map((heat) => (
                      <div
                        key={heat.batchNo}
                        className="bg-[#1C2228] border border-[#2A323B] rounded-xl p-2 flex flex-col gap-1"
                      >
                        <span className="font-display font-extrabold text-xs text-[#FF6B00] uppercase">
                          QUALY {heat.batchNo} ({heat.racers.length} Racers)
                        </span>
                        {heat.racers.map((r, rIdx) => (
                          <span
                            key={r.driverId}
                            className="text-[10px] font-mono text-white/90 truncate"
                          >
                            {rIdx + 1}. {buildMemberTrackDriverId(r, rIdx)}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            finalsSplitGroups.length > 0 && (
              <div className="w-full flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinalsSplit((s) => !s)}
                  className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#38BDF8]/50 rounded-full h-9 px-4 flex items-center justify-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#38BDF8] cursor-pointer transition"
                >
                  <span>
                    {showFinalsSplit
                      ? 'HIDE FINALS STARTING GRID'
                      : `VIEW FINALS GRID (FINAL A–${finalsSplitGroups[finalsSplitGroups.length - 1].letter} FROM QUALY)`}
                  </span>
                </button>

                {showFinalsSplit && (
                  <div className="bg-[#14191E] border border-[#38BDF8]/50 rounded-2xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-extrabold text-xs tracking-wider text-[#38BDF8] uppercase">
                        ALPHABETICAL FINALS GRID (Max {parsedMaxKarts} / Final)
                      </span>
                      <button
                        type="button"
                        onClick={handleExportFinalsGridCsv}
                        className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#38BDF8] text-black flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-2.5 h-2.5" />
                        Export Grid CSV
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                      {finalsSplitGroups.map((grp) => (
                        <div
                          key={grp.letter}
                          className="bg-[#1C2228] border border-[#2A323B] rounded-xl p-2 flex flex-col gap-1"
                        >
                          <span className="font-display font-extrabold text-xs text-[#FF6B00] uppercase">
                            FINAL {grp.letter} ({grp.entries.length} Drivers)
                          </span>
                          {grp.entries.map((e) => (
                            <div
                              key={e.driverId}
                              className="flex items-center justify-between text-[10px] font-mono text-white/90 gap-1"
                            >
                              <span className="truncate">
                                P{e.gridPosInFinal}. {e.displayName}
                              </span>
                              <span className="text-[#38BDF8] shrink-0">
                                {formatMsToLapText(e.bestLapMs) || 'DNS'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* 5. ADD CSV (Supports 1 or Multiple CSV Files at Once!) & SCAN PRINTED SHEET (PHOTO) */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={handleCsvFileSelected}
            className="hidden"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoFileSelected}
            className="hidden"
          />

          <div className="flex flex-col gap-2">
            {/* Primary ADD CSV Pill (Matching Wireframe) */}
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="w-full bg-[#14191E] hover:bg-[#222930] border-2 border-[#FF6B00]/80 hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FF6B00]" />
              <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase truncate">
                {uploadedFileNames.length > 0 && !photoPreviewUrl
                  ? `ADD MORE CSV (${uploadedFileNames.length} FILE${uploadedFileNames.length === 1 ? '' : 'S'} LOADED)`
                  : 'ADD CSV'}
              </span>
            </button>

            {/* Secondary SCAN PRINTED SHEET (PHOTO) Pill */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#38BDF8]/60 hover:border-[#38BDF8] active:scale-[0.99] transition-all rounded-full h-10 px-5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#38BDF8]" />
              <span className="font-display font-extrabold text-xs sm:text-sm tracking-wider text-[#38BDF8] uppercase">
                {isScanningPhoto
                  ? 'SCANNING PRINTED SHEET...'
                  : photoPreviewUrl
                    ? 'CHANGE PRINTED SHEET PHOTO'
                    : 'SCAN PRINTED SHEET (PHOTO)'}
              </span>
            </button>
          </div>

          {/* 6. AUTOMATICALLY SORTED VALIDATION & DRIVER MATCHING TABLE */}
          {(parsedRows.length > 0 || photoPreviewUrl) && (
            <div className="w-full bg-[#14191E] border-2 border-[#FF6B00]/60 rounded-3xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[#2A323B] pb-2">
                <div className="flex flex-col">
                  <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                    AUTO-SORTED {uploadMode} RESULTS ({parsedRows.length}{' '}
                    RACERS)
                  </span>
                  <span className="text-[10px] text-[#8A99AD]">
                    {uploadMode === 'QUALY'
                      ? 'Automatically sorted by fastest Best Lap across all added Qualy CSVs'
                      : 'Automatically sorted & matched to each racer'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([])
                      setUploadedFileNames([])
                      setParseWarnings([])
                      setPhotoPreviewUrl(null)
                    }}
                    className="px-2 py-1 rounded-full bg-[#1C2228] border border-[#2A323B] text-[10px] font-extrabold uppercase text-[#8A99AD] hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBlankRow}
                    className="px-2.5 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B00] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Row
                  </button>
                </div>
              </div>

              {photoPreviewUrl && (
                <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-2xl p-2 flex flex-col items-center gap-1">
                  <img
                    src={photoPreviewUrl}
                    alt="Printed Timing Sheet"
                    className="w-full max-h-44 object-contain rounded-xl"
                  />
                  <span className="text-[10px] text-[#8A99AD]">
                    Printed timing sheet reference photo
                  </span>
                </div>
              )}

              {parseWarnings.length > 0 && (
                <div className="flex flex-col gap-1 bg-[#FF6B00]/10 border border-[#FF6B00]/40 rounded-2xl p-2.5">
                  {parseWarnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 text-[11px] text-[#FF6B00] font-semibold"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Editable Validation Rows */}
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
                {parsedRows.map((row, idx) => {
                  const isMatched = Boolean(row.matchedDriverId)
                  const projectedFinalLetter = String.fromCharCode(
                    65 + Math.min(25, Math.floor(idx / parsedMaxKarts))
                  )

                  return (
                    <div
                      key={row.rowId}
                      className="w-full bg-[#1C2228] border border-[#2A323B] rounded-2xl p-2.5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-[#14191E] border border-[#FF6B00]/60 font-display font-extrabold text-xs text-[#FF6B00] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={row.rawCompetitorName}
                            onChange={(e) =>
                              handleUpdateRow(row.rowId, {
                                rawCompetitorName: e.target.value,
                              })
                            }
                            placeholder="Track Driver ID (e.g. E.Adlers - 33)"
                            className="bg-transparent font-mono font-bold text-xs text-white focus:outline-none border-b border-transparent focus:border-[#FF6B00] truncate"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {uploadMode === 'QUALY' && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8]">
                              → FINAL {projectedFinalLetter}
                            </span>
                          )}
                          <select
                            value={row.status}
                            onChange={(e) =>
                              handleUpdateRow(row.rowId, {
                                status: e.target.value as SessionResultStatus,
                              })
                            }
                            className="bg-[#14191E] border border-[#2A323B] rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#FF6B00] focus:outline-none cursor-pointer"
                          >
                            <option value="FIN">FIN</option>
                            <option value="DNF">DNF</option>
                            <option value="DNS">DNS</option>
                            <option value="DSQ">DSQ</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowId)}
                            title="Remove row"
                            className="text-[#8A99AD] hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* League Driver Match Dropdown */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            isMatched
                              ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/40'
                              : 'bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/40'
                          }`}
                        >
                          {isMatched ? 'MATCHED' : 'GUEST / NEW'}
                        </span>

                        <select
                          value={row.matchedDriverId || ''}
                          onChange={(e) =>
                            handleUpdateRow(row.rowId, {
                              matchedDriverId: e.target.value || null,
                            })
                          }
                          className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-[#FF6B00] cursor-pointer"
                        >
                          <option value="">
                            + Auto-Create / Guest (
                            {row.rawCompetitorName || 'Driver'})
                          </option>
                          {members.map((m, mIdx) => (
                            <option key={m.driverId} value={m.driverId}>
                              {buildMemberTrackDriverId(m, mIdx)} (
                              {`${m.firstName} ${m.surname}`.trim() ||
                                m.displayName}
                              )
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Laps, Best Lap, and Total Time (for RACE mode) */}
                      <div
                        className={`grid gap-2 ${
                          uploadMode === 'RACE' ? 'grid-cols-3' : 'grid-cols-2'
                        }`}
                      >
                        <div className="bg-[#14191E] border border-[#2A323B] rounded-xl px-2.5 py-1 flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-[#8A99AD]">
                            Laps:
                          </span>
                          <input
                            type="number"
                            value={row.laps ?? ''}
                            onChange={(e) =>
                              handleUpdateRow(row.rowId, {
                                laps:
                                  e.target.value === ''
                                    ? null
                                    : parseInt(e.target.value, 10),
                              })
                            }
                            placeholder="-"
                            className="w-10 bg-transparent text-right font-mono font-bold text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div className="bg-[#14191E] border border-[#2A323B] rounded-xl px-2.5 py-1 flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-[#8A99AD]">
                            Best Lap:
                          </span>
                          <input
                            type="text"
                            value={row.bestLapText}
                            onChange={(e) =>
                              handleUpdateRow(row.rowId, {
                                bestLapText: e.target.value,
                              })
                            }
                            placeholder="53.378"
                            className="w-16 bg-transparent text-right font-mono font-bold text-xs text-[#38BDF8] focus:outline-none"
                          />
                        </div>

                        {uploadMode === 'RACE' && (
                          <div className="bg-[#14191E] border border-[#2A323B] rounded-xl px-2.5 py-1 flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-[#8A99AD]">
                              Total:
                            </span>
                            <input
                              type="text"
                              value={row.totalTimeText}
                              onChange={(e) =>
                                handleUpdateRow(row.rowId, {
                                  totalTimeText: e.target.value,
                                })
                              }
                              placeholder="08:03.900"
                              className="w-20 bg-transparent text-right font-mono font-bold text-xs text-[#FF6B00] focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loadingEventState && (
            <span className="text-[11px] text-center text-[#8A99AD]">
              Syncing race session status...
            </span>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 bg-[#22C55E]/15 border border-[#22C55E]/50 rounded-2xl p-3 text-xs text-[#22C55E] font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-bold text-red-400 text-center">
              {errorMsg}
            </p>
          )}
        </div>

        {/* 7. BOTTOM TWO CARDS: CANCEL & UPLOAD RESULT (Matching Wireframe) */}
        <div className="grid grid-cols-2 gap-3.5 w-full pt-1">
          <button
            type="button"
            onClick={onBack}
            className="bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] hover:border-red-500/50 active:scale-[0.98] transition-all rounded-3xl h-36 p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer"
          >
            <span className="font-display font-extrabold text-2xl tracking-wider text-[#EF4444] uppercase">
              CANCEL
            </span>
          </button>

          <button
            type="button"
            disabled={isPublishing || parsedRows.length === 0}
            onClick={handleConfirmUploadResult}
            className="bg-[#14191E] hover:bg-[#192026] border border-[#FF6B00]/70 hover:border-[#FF6B00] active:scale-[0.98] transition-all rounded-3xl h-36 p-4 flex flex-col items-center justify-center text-center gap-1 shadow-lg cursor-pointer disabled:opacity-40"
          >
            <Upload className="w-5 h-5 text-[#FF6B00]" />
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-wider text-[#FF6B00] uppercase leading-tight">
              {isPublishing ? 'UPLOADING...' : 'UPLOAD RESULT'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
