import type { TimedLine } from './active-line'

// Parses LRC synced lyrics: lines like "[01:23.45] text", supporting multiple
// timestamps per line. Metadata tags ([ar:...], [ti:...]) are ignored because
// their content is not a mm:ss timestamp.
const STAMP_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(source: string): TimedLine[] {
  const out: TimedLine[] = []

  for (const raw of source.split(/\r?\n/)) {
    STAMP_RE.lastIndex = 0
    const stamps: number[] = []
    let lastEnd = 0
    let m: RegExpExecArray | null
    while ((m = STAMP_RE.exec(raw)) !== null) {
      const min = Number(m[1])
      const sec = Number(m[2])
      const frac = m[3] ? Number(m[3].padEnd(3, '0').slice(0, 3)) : 0
      stamps.push(min * 60_000 + sec * 1000 + frac)
      lastEnd = STAMP_RE.lastIndex
    }
    if (stamps.length === 0) continue

    const text = raw.slice(lastEnd).trim()
    for (const time of stamps) out.push({ time, text })
  }

  out.sort((a, b) => a.time - b.time)
  return out
}
