import React, { useMemo } from 'react'

// Standard ISO/IEC 18004 QR Code Matrix Generator (Byte Mode, ECC Level L, Versions 1..10)
interface VersionSpec {
  version: number
  size: number
  totalDataCodewords: number
  ecCodewordsPerBlock: number
  numBlocksGroup1: number
  dataCodewordsGroup1: number
  numBlocksGroup2: number
  dataCodewordsGroup2: number
  alignmentCenters: number[]
}

const VERSION_SPECS_L: VersionSpec[] = [
  { version: 1, size: 21, totalDataCodewords: 19, ecCodewordsPerBlock: 7, numBlocksGroup1: 1, dataCodewordsGroup1: 19, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [] },
  { version: 2, size: 25, totalDataCodewords: 34, ecCodewordsPerBlock: 10, numBlocksGroup1: 1, dataCodewordsGroup1: 34, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 18] },
  { version: 3, size: 29, totalDataCodewords: 55, ecCodewordsPerBlock: 15, numBlocksGroup1: 1, dataCodewordsGroup1: 55, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 22] },
  { version: 4, size: 33, totalDataCodewords: 80, ecCodewordsPerBlock: 20, numBlocksGroup1: 1, dataCodewordsGroup1: 80, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 26] },
  { version: 5, size: 37, totalDataCodewords: 108, ecCodewordsPerBlock: 26, numBlocksGroup1: 1, dataCodewordsGroup1: 108, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 30] },
  { version: 6, size: 41, totalDataCodewords: 136, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 34] },
  { version: 7, size: 45, totalDataCodewords: 156, ecCodewordsPerBlock: 20, numBlocksGroup1: 2, dataCodewordsGroup1: 78, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 22, 38] },
  { version: 8, size: 49, totalDataCodewords: 194, ecCodewordsPerBlock: 24, numBlocksGroup1: 2, dataCodewordsGroup1: 97, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 24, 42] },
  { version: 9, size: 53, totalDataCodewords: 232, ecCodewordsPerBlock: 30, numBlocksGroup1: 2, dataCodewordsGroup1: 116, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 26, 46] },
  { version: 10, size: 57, totalDataCodewords: 274, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 2, dataCodewordsGroup2: 69, alignmentCenters: [6, 28, 50] },
]

// GF(256) tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const root = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], root)
    }
    poly = next
  }
  return poly
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen)
  const rem = new Uint8Array(ecLen)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0]
    for (let j = 0; j < ecLen - 1; j++) {
      rem[j] = rem[j + 1]
    }
    rem[ecLen - 1] = 0
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor)
      }
    }
  }
  return rem
}

function computeFormatBits(eclBits: number, maskPattern: number): number {
  const data = (eclBits << 3) | maskPattern
  let rem = data << 10
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10)
    }
  }
  return ((data << 10) | rem) ^ 0x5412
}

function computeVersionBits(version: number): number {
  let rem = version << 12
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x1f25 << (i - 12)
    }
  }
  return (version << 12) | rem
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)

  // Pick smallest version that fits byte mode
  let spec = VERSION_SPECS_L[VERSION_SPECS_L.length - 1]
  for (const candidate of VERSION_SPECS_L) {
    const countBits = candidate.version <= 9 ? 8 : 16
    const maxBytes = Math.floor(
      (candidate.totalDataCodewords * 8 - 4 - countBits) / 8
    )
    if (bytes.length <= maxBytes) {
      spec = candidate
      break
    }
  }

  const countBits = spec.version <= 9 ? 8 : 16
  const bitBuf: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >> i) & 1)
    }
  }

  // Mode indicator: Byte mode = 0100
  pushBits(0b0100, 4)
  pushBits(bytes.length, countBits)
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8)
  }

  // Terminator up to 4 bits
  const maxDataBits = spec.totalDataCodewords * 8
  const termLen = Math.min(4, maxDataBits - bitBuf.length)
  pushBits(0, termLen)

  // Pad to byte boundary
  while (bitBuf.length % 8 !== 0) {
    bitBuf.push(0)
  }

  const dataCodewords = new Uint8Array(spec.totalDataCodewords)
  const byteLen = bitBuf.length / 8
  for (let i = 0; i < byteLen; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitBuf[i * 8 + j]
    }
    dataCodewords[i] = b
  }

  // Pad alternating 0xEC, 0x11
  let padToggle = true
  for (let i = byteLen; i < spec.totalDataCodewords; i++) {
    dataCodewords[i] = padToggle ? 0xec : 0x11
    padToggle = !padToggle
  }

  // Split into blocks & compute EC
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []
  let offset = 0
  for (let b = 0; b < spec.numBlocksGroup1; b++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup1)
    offset += spec.dataCodewordsGroup1
    dataBlocks.push(block)
    ecBlocks.push(rsEncode(block, spec.ecCodewordsPerBlock))
  }
  for (let b = 0; b < spec.numBlocksGroup2; b++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup2)
    offset += spec.dataCodewordsGroup2
    dataBlocks.push(block)
    ecBlocks.push(rsEncode(block, spec.ecCodewordsPerBlock))
  }

  // Interleave data codewords + EC codewords
  const finalCodewords: number[] = []
  const maxBlockLen = Math.max(
    spec.dataCodewordsGroup1,
    spec.dataCodewordsGroup2
  )
  for (let i = 0; i < maxBlockLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalCodewords.push(block[i])
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const ec of ecBlocks) {
      finalCodewords.push(ec[i])
    }
  }

  const size = spec.size
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  )
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  )

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark
      isFunction[r][c] = true
    }
  }

  // Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr
        const c = leftC + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const inOuter =
          dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6)
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setFunctionModule(r, c, inOuter || inInner)
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0)
    setFunctionModule(i, 6, i % 2 === 0)
  }

  // Alignment patterns
  const centers = spec.alignmentCenters
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue
      }
      const cr = centers[i]
      const cc = centers[j]
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 ||
            (dr === 0 && dc === 0)
          setFunctionModule(cr + dr, cc + dc, dark)
        }
      }
    }
  }

  // Dark module
  setFunctionModule(4 * spec.version + 9, 8, true)

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false)
    if (!isFunction[i][8]) setFunctionModule(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, size - 1 - i, false)
    setFunctionModule(size - 1 - i, 8, false)
  }

  // Version info for Version >= 7
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version)
    for (let i = 0; i < 18; i++) {
      const dark = ((vBits >> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFunctionModule(b, a, dark)
      setFunctionModule(a, b, dark)
    }
  }

  // Place data bits in zigzag upward/downward pairs
  let bitIdx = 0
  const totalBits = finalCodewords.length * 8
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const c = right - j
        if (!isFunction[r][c]) {
          let dark = false
          if (bitIdx < totalBits) {
            const cw = finalCodewords[bitIdx >> 3]
            dark = ((cw >> (7 - (bitIdx & 7))) & 1) === 1
            bitIdx++
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) {
            dark = !dark
          }
          modules[r][c] = dark
        }
      }
    }
    upward = !upward
  }

  // Write Format Information (ECC Level L = 01, Mask = 0)
  const formatBits = computeFormatBits(0b01, 0)
  for (let i = 0; i <= 5; i++) {
    setFunctionModule(8, i, ((formatBits >> i) & 1) === 1)
  }
  setFunctionModule(8, 7, ((formatBits >> 6) & 1) === 1)
  setFunctionModule(8, 8, ((formatBits >> 7) & 1) === 1)
  setFunctionModule(7, 8, ((formatBits >> 8) & 1) === 1)
  for (let i = 9; i < 15; i++) {
    setFunctionModule(14 - i, 8, ((formatBits >> i) & 1) === 1)
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, size - 1 - i, ((formatBits >> i) & 1) === 1)
  }
  for (let i = 8; i < 15; i++) {
    setFunctionModule(size - 15 + i, 8, ((formatBits >> i) & 1) === 1)
  }

  return modules
}

export const QrCodeSvg: React.FC<{
  value: string
  className?: string
}> = ({ value, className = 'w-44 h-44' }) => {
  const matrix = useMemo(() => generateQrMatrix(value || 'https://krapp'), [value])
  const size = matrix.length
  const margin = 3
  const viewSize = size + margin * 2

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="League Invite QR Code"
    >
      <rect width={viewSize} height={viewSize} rx={2} fill="#FFFFFF" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect
              key={`${r}-${c}`}
              x={c + margin}
              y={r + margin}
              width={1}
              height={1}
              fill="#0D1114"
            />
          ) : null
        )
      )}
    </svg>
  )
}
