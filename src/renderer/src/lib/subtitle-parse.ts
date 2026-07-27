import type { Cue } from './active-line'

const TS_RE =
  /(\d{1,2}):(\d{2})(?::(\d{2}))?[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2})(?::(\d{2}))?[.,](\d{1,3})/

export function parseSubtitle(source: string): Cue[] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const cues: Cue[] = []
  let i = 0
  while (i < lines.length) {
    const match = TS_RE.exec(lines[i])
    if (!match) {
      i++
      continue
    }
    const start = tsToMs(match[1], match[2], match[3], match[4])
    const end = tsToMs(match[5], match[6], match[7], match[8])
    i++
    const body: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      body.push(lines[i])
      i++
    }
    cues.push({ start, end, text: body.join('\n').trim() })
    while (i < lines.length && lines[i].trim() === '') i++
  }
  return cues
}

function tsToMs(h: string | undefined, m: string, s: string | undefined, ms: string): number {
  const hours = s != null ? Number(h) : 0
  const minutes = s != null ? Number(m) : Number(h)
  const seconds = s != null ? Number(s) : Number(m)
  const millis = Number(ms.padEnd(3, '0').slice(0, 3))
  return hours * 3600_000 + minutes * 60_000 + seconds * 1000 + millis
}
