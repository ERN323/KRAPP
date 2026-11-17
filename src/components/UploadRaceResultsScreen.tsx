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
  // 1. Mode: 'QUALY' or 'RACE' (Finals)
  const [uploadMode, setUploadMode] = useState<'QUALY' | 'RACE'>('QUALY')

  // 2. Selected Scheduled Race (`DATE` in wireframe)
  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => events[0]?.id || ''
  )
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false)

  // 3. Available Karts / Max Racers per Heat (`RACER COUNT` in wireframe, default 12)
  const [maxKartsPerHeat, setMaxKartsPerHeat] = useState<string>('12')

  // 4. Heat / Final selector (Qualy 1, 2, 3... or Final A, B, C...)
  const [selectedQualyBatch, setSelectedQualyBatch] = useState<number>(1)
  const [selectedFinalLetter, setSelectedFinalLetter] = useState<string>('A')

  // 5. Event Upload State from Supabase (which sessions are uploaded + Combined Quali for Finals split)
  const [eventUploadState, setEventUploadState] = useState<EventUploadState>({
    uploadedSessions: [],
    combinedQuali: [],
    aliases: [],
  })
  const [loadingEventState, setLoadingEventState] = useState(false)

  // 6. Qualy Randomizer State
  const [showQualyRandomizer, setShowQualyRandomizer] = useState(false)
  const [randomizedHeats, setRandomizedHeats] = useState<QualyHeatGroup[]>([])

  // 7. Finals Split Preview State
  const [showFinalsSplit, setShowFinalsSplit] = useState(false)

  // 8. Parsed / Editable Rows for Validation before upload
  const [parsedRows, setParsedRows] = useState<ParsedSessionRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isScanningPhoto, setIsScanningPhoto] = useState(false)

  // 9. Submission State
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

  // Compute Alphabetical Finals Split (A, B, C...) from Combined Qualifying
  const finalsSplitGroups = computeAlphabeticalFinalsSplit(
    eventUploadState.combinedQuali,
    parsedMaxKarts
  )

  // Generate randomized equal Qualy heats
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

  // Handle SpeedHive CSV File Selection
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg('')
    setSuccessMsg('')
    setUploadedFileName(file.name)
    setPhotoPreviewUrl(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const expectedKind = uploadMode === 'QUALY' ? 'QUALI' : 'FINAL'
        const parsed = parseSpeedhiveCsvText(
          text,
          members,
          eventUploadState.aliases,
          expectedKind
        )
        setParsedRows(parsed.rows)
        setParseWarnings(parsed.warnings)
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Could not parse CSV file'
        )
      }
    }
    reader.readAsText(file)
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
    setUploadedFileName(file.name)

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null
      if (!dataUrl) return
      setPhotoPreviewUrl(dataUrl)

      // Check if an optional Gemini API key is configured for automatic Vision OCR
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
            setParsedRows(parsed.rows)
            setParseWarnings([
              'Scanned from printed sheet photo — please review all rows and lap times below before clicking UPLOAD RESULT.',
              ...parsed.warnings,
            ])
            setIsScanningPhoto(false)
            return
          }
        } catch {
          // Fall back to interactive photo-assisted verification table below
        }
        setIsScanningPhoto(false)
      }

      // Pre-populate interactive verification rows from current Final split or Qualy heat so the Admin can verify/enter times alongside the photo
      if (parsedRows.length === 0) {
        prefillRowsForCurrentSession()
      }
      setParseWarnings([
        'Printed timing sheet photo attached! Review or enter the times from the photo in the validation table below before clicking UPLOAD RESULT.',
      ])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Helper to pre-populate rows from the current Qualy Heat or Final Group
  const prefillRowsForCurrentSession = () => {
    if (uploadMode === 'RACE') {
      const targetFinal = finalsSplitGroups.find(
        (g) => g.letter === selectedFinalLetter
      )
      if (targetFinal && targetFinal.entries.length > 0) {
        setParsedRows(
          targetFinal.entries.map((entry, idx) => {
            const memberObj = members.find((m) => m.driverId === entry.driverId)
            const trackId = memberObj
              ? buildMemberTrackDriverId(memberObj, idx)
              : entry.displayName
            return {
              rowId: `prefill-${idx}-${Date.now()}`,
              posInSession: idx + 1,
              startNumber: entry.driverNumber || String(idx + 1),
              rawCompetitorName: trackId,
              matchedDriverId: entry.driverId,
              className: '',
              status: 'FIN',
              laps: 10,
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
                'Start Number': entry.driverNumber || String(idx + 1),
                Competitor: trackId,
              },
            }
          })
        )
        return
      }
    }

    const heatRacers =
      randomizedHeats.find((h) => h.batchNo === selectedQualyBatch)?.racers ||
      members.slice(0, parsedMaxKarts)

    setParsedRows(
      heatRacers.map((m, idx) => {
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

  // Publish Validated Results to Supabase
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
      await uploadSessionResultsInSupabase({
        eventId: selectedEvent.id,
        kind: kindToUpload,
        batchNo: kindToUpload === 'QUALI' ? selectedQualyBatch : null,
        finalLetter: kindToUpload === 'FINAL' ? selectedFinalLetter : null,
        maxKarts: parsedMaxKarts,
        rows: parsedRows.map((r, idx) => {
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
            posInSession: r.posInSession ?? idx + 1,
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
              Pos: String(r.posInSession ?? idx + 1),
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

      const sessionLabel =
        uploadMode === 'QUALY'
          ? `QUALY ${selectedQualyBatch}`
          : `FINAL ${selectedFinalLetter}`
      setSuccessMsg(
        `${sessionLabel} (${parsedRows.length} drivers) validated & uploaded to database!`
      )
      setParsedRows([])
      setParseWarnings([])
      setUploadedFileName('')
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

  // Helper to check if a Qualy batch or Final letter is already uploaded
  const isQualyUploaded = (batchNo: number) =>
    eventUploadState.uploadedSessions.some(
      (s) => s.kind === 'QUALI' && s.batchNo === batchNo
    )
  const isFinalUploaded = (letter: string) =>
    eventUploadState.uploadedSessions.some(
      (s) => s.kind === 'FINAL' && s.finalLetter === letter
    )

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

          {/* 1. RACE / QUALY MODE SELECTOR PILLS (Matching Wireframe) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadMode('RACE')
                setErrorMsg('')
                setSuccessMsg('')
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

          {/* 3. RACER COUNT / AVAILABLE KARTS PER HEAT PILL (Max 12 or fewer) */}
          <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                RACER COUNT (MAX KARTS / HEAT)
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              value={maxKartsPerHeat}
              onChange={(e) => setMaxKartsPerHeat(e.target.value)}
              className="w-16 bg-[#1C2228] border border-[#2A323B] rounded-full h-7 text-center font-display font-extrabold text-sm text-white focus:outline-none focus:border-[#FF6B00]"
            />
          </div>

          {/* 4. SESSION PICKER + QUALY RANDOMIZER OR FINALS ALPHABETICAL SPLIT */}
          {uploadMode === 'QUALY' ? (
            <div className="w-full bg-[#14191E] border border-[#2A323B] rounded-2xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8A99AD]">
                  SELECT QUALY HEAT TO UPLOAD:
                </span>
                <button
                  type="button"
                  onClick={handleRunQualyRandomizer}
                  className="px-2.5 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#38BDF8]/60 text-[10px] font-extrabold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1 cursor-pointer transition"
                >
                  <Shuffle className="w-3 h-3" />
                  Qualy Randomizer
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {[1, 2, 3, 4].map((batchNo) => {
                  const isActive = selectedQualyBatch === batchNo
                  const isDone = isQualyUploaded(batchNo)
                  return (
                    <button
                      key={batchNo}
                      type="button"
                      onClick={() => setSelectedQualyBatch(batchNo)}
                      className={`px-3.5 py-1.5 rounded-full font-display font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#FF6B00] text-black border border-white shadow'
                          : 'bg-[#1C2228] hover:bg-[#252D35] text-white border border-[#2A323B]'
                      }`}
                    >
                      <span>QUALY {batchNo}</span>
                      {isDone && (
                        <Check
                          className={`w-3.5 h-3.5 stroke-[3] ${
                            isActive ? 'text-black' : 'text-[#22C55E]'
                          }`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* QUALY RANDOMIZER PANEL (Divides League Racers Equally Across Available Karts) */}
              {showQualyRandomizer && randomizedHeats.length > 0 && (
                <div className="mt-1 bg-[#1C2228] border border-[#38BDF8]/50 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-xs tracking-wider text-[#38BDF8] uppercase">
                      RANDOM QUALY HEATS ({members.length} Racers · Max{' '}
                      {parsedMaxKarts} Karts)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRunQualyRandomizer}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#14191E] border border-[#2A323B] text-[#FF6B00] cursor-pointer"
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
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {randomizedHeats.map((heat) => (
                      <div
                        key={heat.batchNo}
                        className="bg-[#14191E] border border-[#2A323B] rounded-xl p-2 flex flex-col gap-1"
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
            <div className="w-full bg-[#14191E] border border-[#2A323B] rounded-2xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8A99AD]">
                  SELECT FINAL (ALPHABETICAL ORDER):
                </span>
                {finalsSplitGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFinalsSplit((s) => !s)}
                    className="px-2.5 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#38BDF8]/60 text-[10px] font-extrabold uppercase tracking-wider text-[#38BDF8] cursor-pointer transition"
                  >
                    {showFinalsSplit
                      ? 'Hide Finals Grid'
                      : `View A–${finalsSplitGroups[finalsSplitGroups.length - 1].letter} Grid`}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {(['A', 'B', 'C', 'D'] as string[]).map((letter) => {
                  const isActive = selectedFinalLetter === letter
                  const isDone = isFinalUploaded(letter)
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setSelectedFinalLetter(letter)}
                      className={`px-3.5 py-1.5 rounded-full font-display font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#FF6B00] text-black border border-white shadow'
                          : 'bg-[#1C2228] hover:bg-[#252D35] text-white border border-[#2A323B]'
                      }`}
                    >
                      <span>FINAL {letter}</span>
                      {isDone && (
                        <Check
                          className={`w-3.5 h-3.5 stroke-[3] ${
                            isActive ? 'text-black' : 'text-[#22C55E]'
                          }`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* AUTOMATIC ALPHABETICAL FINALS SPLIT FROM COMBINED QUALIFYING */}
              {showFinalsSplit && finalsSplitGroups.length > 0 && (
                <div className="mt-1 bg-[#1C2228] border border-[#38BDF8]/50 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-xs tracking-wider text-[#38BDF8] uppercase">
                      FINALS GRID FROM QUALY (Max {parsedMaxKarts} / Final)
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
                        className="bg-[#14191E] border border-[#2A323B] rounded-xl p-2 flex flex-col gap-1"
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
          )}

          {/* 5. ADD CSV & SCAN PRINTED SHEET (PHOTO) BUTTONS */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
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
              <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                {uploadedFileName && !photoPreviewUrl
                  ? `CSV: ${uploadedFileName}`
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

          {/* 6. INTERACTIVE VALIDATION & DRIVER MATCHING TABLE (Before Database Upload) */}
          {(parsedRows.length > 0 || photoPreviewUrl) && (
            <div className="w-full bg-[#14191E] border-2 border-[#FF6B00]/60 rounded-3xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[#2A323B] pb-2">
                <div className="flex flex-col">
                  <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                    VALIDATE{' '}
                    {uploadMode === 'QUALY'
                      ? `QUALY ${selectedQualyBatch}`
                      : `FINAL ${selectedFinalLetter}`}{' '}
                    ({parsedRows.length} ROWS)
                  </span>
                  <span className="text-[10px] text-[#8A99AD]">
                    Check driver matches & times before uploading to database
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="px-2.5 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B00] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Row
                </button>
              </div>

              {/* Optional Printed Sheet Photo Preview */}
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

              {/* Parse Warnings */}
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
                  return (
                    <div
                      key={row.rowId}
                      className="w-full bg-[#1C2228] border border-[#2A323B] rounded-2xl p-2.5 flex flex-col gap-2"
                    >
                      {/* Row Top Line: Pos + CSV Competitor + Status + Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-[#14191E] border border-[#FF6B00]/60 font-display font-extrabold text-xs text-[#FF6B00] flex items-center justify-center shrink-0">
                            {row.posInSession ?? idx + 1}
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

                      {/* Row Middle Line: League Driver Match Dropdown */}
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
                            + Auto-Create / Guest ({row.rawCompetitorName || 'Driver'})
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

                      {/* Row Bottom Line: Laps, Best Lap, and Total Time (for RACE mode) */}
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
