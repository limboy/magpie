export type TimedLine = { time: number; text: string }

export function findActiveIndexByStart(lines: TimedLine[], timeMs: number, hint = 0): number {
  if (lines.length === 0) return -1
  if (timeMs < lines[0].time) return -1
  const h = Math.max(0, Math.min(hint, lines.length - 1))
  if (lines[h].time <= timeMs && (h === lines.length - 1 || lines[h + 1].time > timeMs)) {
    return h
  }
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= timeMs) lo = mid + 1
    else hi = mid - 1
  }
  return hi
}

export type Cue = { start: number; end: number; text: string }

export function findActiveCueIndex(cues: Cue[], timeMs: number, hint = 0): number {
  if (cues.length === 0) return -1
  const h = Math.max(0, Math.min(hint, cues.length - 1))
  if (timeMs >= cues[h].start && timeMs <= cues[h].end) return h
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (timeMs < cues[mid].start) hi = mid - 1
    else if (timeMs > cues[mid].end) lo = mid + 1
    else return mid
  }
  return -1
}
