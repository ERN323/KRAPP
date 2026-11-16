export type TrackConfigCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface KartingTrackInfo {
  slug: string
  name: string
  address: string
  configurations: TrackConfigCode[]
  inProgressConfigurations?: TrackConfigCode[]
  svgFiles: Partial<Record<TrackConfigCode, string>>
  searchKeywords: string[]
}

export const KARTING_TRACKS: KartingTrackInfo[] = [
  {
    slug: 'kandava',
    name: 'KANDAVA KARTODROMS',
    address: 'Jelgavas iela 16, Kandava, Kandava pilsēta, Tukuma novads, LV-3120',
    configurations: ['A', 'B'],
    svgFiles: {
      A: 'Kandavas-Kartodroms-a.svg',
      B: 'Kandavas-Kartodroms-b.svg',
    },
    searchKeywords: ['kandava', 'kandavas', 'kartodroms', 'jelgavas iela 16', 'tukuma'],
  },
  {
    slug: 'kartings-lv',
    name: 'Kartings.lv',
    address: 'Gustava Zemgala gat. 77-k-1, Vidzemes priekšpilsēta, Rīga, LV-1039',
    configurations: ['A', 'B'],
    svgFiles: {
      A: 'Kartings-lv-a.svg',
      B: 'Kartings-lv-b.svg',
    },
    searchKeywords: ['kartings.lv', 'kartingi.lv', 'gustava zemgala', 'riga', 'rīga'],
  },
  {
    slug: 'madona',
    name: 'Madonas kartinga trase',
    address: 'Gaujas iela 41, Madona, Madona pilsēta, Madonas novads, LV-4801',
    configurations: ['A', 'B'],
    svgFiles: {
      A: 'Madonas-kartinga-trase-a.svg',
      B: 'Madonas-kartinga-trase-b.svg',
    },
    searchKeywords: ['madona', 'madonas', 'gaujas iela 41'],
  },
  {
    slug: 'rullitis-jelgava',
    name: 'Rullītis Jelgava',
    address: 'Kartinga sporta centrs, Aku ceļš 1, Jelgava, LV-3008',
    configurations: ['A', 'B', 'C', 'D', 'E', 'F'],
    svgFiles: {
      A: 'Rullitis-Jelgava-a.svg',
      B: 'Rullitis-Jelgava-b.svg',
      C: 'Rullitis-Jelgava-c.svg',
      D: 'Rullitis-Jelgava-d.svg',
      E: 'Rullitis-Jelgava-e.svg',
      F: 'Rullitis-Jelgava-f.svg',
    },
    searchKeywords: ['rullitis', 'rullītis', 'jelgava', 'aku cels', 'aku ceļš'],
  },
  {
    slug: 'xl-riga',
    name: 'XL Rīga kartinga nams',
    address: 'Ūdens iela 23, Kurzemes rajons, Rīga, LV-1007',
    configurations: ['A', 'B'],
    svgFiles: {
      A: 'XL-Riga-kartinga-nams-a.svg',
      B: 'XL-Riga-kartinga-nams-b.svg',
    },
    searchKeywords: ['xl riga', 'xl rīga', 'udens iela', 'ūdens iela', 'kartinga nams'],
  },
  {
    slug: 'baciunu-siauliai',
    name: 'Baciunu kartodromas MANDE, Šauļi, LT',
    address: 'Bačiūnų g. 27A, Šiauliai, 76383 Šiaulių m. sav., Lithuania',
    configurations: ['A', 'B'],
    svgFiles: {
      A: 'Baciunu-kartodromas-MANDE-Sauli-LT-a.svg',
      B: 'Baciunu-kartodromas-MANDE-Sauli-LT-b.svg',
    },
    searchKeywords: ['baciunu', 'bačiūnų', 'mande', 'sauli', 'šauļi', 'siauliai', 'šiauliai', 'lithuania'],
  },
  {
    slug: 'serbentu-siauliai',
    name: 'Serbentu kartodromas MANDE, Šauļi, LT',
    address: 'Serbentų g. 86, Šiauliai, 78136 Šiaulių m. sav., Lithuania',
    configurations: ['A', 'B'],
    inProgressConfigurations: ['C', 'D'],
    svgFiles: {
      A: 'Serbentu-kartodromas-MANDE-Sauli-LT-a.svg',
      B: 'Serbentu-kartodromas-MANDE-Sauli-LT-b.svg',
    },
    searchKeywords: ['serbentu', 'serbentų', 'mande', 'sauli', 'šauļi', 'siauliai', 'šiauliai', 'lithuania'],
  },
]

function normalizeSearchText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function filterKartingTracks(query: string): KartingTrackInfo[] {
  const q = normalizeSearchText(query)
  if (!q) return KARTING_TRACKS
  return KARTING_TRACKS.filter((track) => {
    const haystack = normalizeSearchText(
      `${track.name} ${track.address} ${track.searchKeywords.join(' ')}`
    )
    return haystack.includes(q)
  })
}

export function findKartingTrack(
  slugOrNameOrLocation?: string | null
): KartingTrackInfo | null {
  if (!slugOrNameOrLocation) return null
  const raw = slugOrNameOrLocation.trim()
  if (!raw) return null

  const bySlug = KARTING_TRACKS.find(
    (t) => t.slug.toLowerCase() === raw.toLowerCase()
  )
  if (bySlug) return bySlug

  const norm = normalizeSearchText(raw)
  const byExactName = KARTING_TRACKS.find(
    (t) =>
      normalizeSearchText(t.name) === norm ||
      normalizeSearchText(t.address) === norm
  )
  if (byExactName) return byExactName

  // Fuzzy match by keywords or substring
  for (const track of KARTING_TRACKS) {
    const trackNorm = normalizeSearchText(track.name)
    if (norm.includes(trackNorm) || trackNorm.includes(norm)) {
      return track
    }
    for (const kw of track.searchKeywords) {
      if (norm.includes(normalizeSearchText(kw))) {
        return track
      }
    }
  }

  return null
}

export function getTrackSvgUrl(
  track: KartingTrackInfo | null,
  config?: string | null
): string {
  const chosenTrack = track || KARTING_TRACKS[0]
  const cleanConfig = (config || 'A').toUpperCase() as TrackConfigCode
  const fileName =
    chosenTrack.svgFiles[cleanConfig] ||
    chosenTrack.svgFiles.A ||
    'Kandavas-Kartodroms-a.svg'
  const baseUrl = import.meta.env.BASE_URL || './'
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${prefix}tracks/${fileName}`
}

export function getTrackNavigationLinks(
  trackName: string,
  address: string
): {
  googleMapsUrl: string
  wazeUrl: string
  appleMapsUrl: string
} {
  const fullQuery = address ? `${trackName}, ${address}` : trackName
  const encodedQuery = encodeURIComponent(fullQuery)
  const encodedAddress = encodeURIComponent(address || trackName)

  return {
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`,
    wazeUrl: `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
    appleMapsUrl: `https://maps.apple.com/?daddr=${encodedAddress}`,
  }
}
