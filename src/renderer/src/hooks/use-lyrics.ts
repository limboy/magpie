import { useEffect, useState } from 'react'
import type { TimedLine } from '@/lib/active-line'
import { parseLrc } from '@/lib/lrc-parse'

export type LyricsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'synced'; lines: TimedLine[] }
  | { status: 'plain'; text: string }

// Resolved lyrics are memoised per track signature so toggling the full player
// or revisiting a track is instant. The main process handles disk caching.
const cache = new Map<string, LyricsState>()

function signature(path: string, title: string, artist: string, durationMs: number | null): string {
  return `${path}|${title}|${artist}|${durationMs ? Math.round(durationMs / 1000) : 0}`
}

export function useLyrics(
  path: string | null,
  title: string,
  artist: string,
  album: string,
  durationMs: number | null
): LyricsState {
  // Re-render trigger fired once an async fetch resolves into the cache.
  const [, bump] = useState(0)

  const ready = !!path && !!title
  const key = ready ? signature(path as string, title, artist, durationMs) : null

  useEffect(() => {
    if (!key || !path || cache.has(key)) return

    let cancelled = false
    window.soundbox
      .getLyrics({ path, title, artist, album, durationMs })
      .then((result) => {
        let next: LyricsState
        if (result?.synced) {
          const lines = parseLrc(result.synced)
          next = lines.length > 0 ? { status: 'synced', lines } : { status: 'none' }
        } else if (result?.plain) {
          next = { status: 'plain', text: result.plain }
        } else {
          next = { status: 'none' }
        }
        cache.set(key, next)
        if (!cancelled) bump((n) => n + 1)
      })
      .catch(() => {
        cache.set(key, { status: 'none' })
        if (!cancelled) bump((n) => n + 1)
      })

    return () => {
      cancelled = true
    }
  }, [key, path, title, artist, album, durationMs])

  if (!key) return { status: 'idle' }
  return cache.get(key) ?? { status: 'loading' }
}
