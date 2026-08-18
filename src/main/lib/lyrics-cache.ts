import { app } from 'electron'
import { join, parse } from 'node:path'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

// Lyrics are fetched from LRCLIB (https://lrclib.net) and cached on disk, keyed
// by a signature of path + metadata + duration so improved metadata re-fetches.
// "Not found" results are cached too, to avoid hammering the API.

export interface LyricsResult {
  synced: string | null
  plain: string | null
  subtitle?: {
    format: 'srt' | 'vtt'
    content: string
  }
}

export interface LyricsQuery {
  path: string
  title: string
  artist: string
  album: string
  durationMs: number | null
}

const UA = 'SoundBox (https://github.com/limboy/magpie)'

const memCache = new Map<string, LyricsResult | null>()

const SIDECAR_EXTENSIONS = ['lrc', 'srt', 'vtt'] as const

async function readSidecar(path: string): Promise<LyricsResult | null> {
  const { dir, name } = parse(path)

  for (const extension of SIDECAR_EXTENSIONS) {
    try {
      const content = await readFile(join(dir, `${name}.${extension}`), 'utf8')
      if (extension === 'lrc') {
        return { synced: content, plain: null }
      }
      return { synced: null, plain: null, subtitle: { format: extension, content } }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Failed to read ${extension.toUpperCase()} sidecar for ${path}:`, error)
      }
    }
  }

  return null
}

function lyricsDir(): string {
  return join(app.getPath('userData'), 'lyrics')
}

function signature(q: LyricsQuery): string {
  const durationSec = q.durationMs ? Math.round(q.durationMs / 1000) : 0
  return createHash('sha1')
    .update(`${q.path}|${q.title}|${q.artist}|${q.album}|${durationSec}`)
    .digest('hex')
}

interface LrclibRecord {
  duration?: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

function pickLyrics(rec: LrclibRecord): LyricsResult | null {
  if (rec.syncedLyrics || rec.plainLyrics) {
    return { synced: rec.syncedLyrics || null, plain: rec.plainLyrics || null }
  }
  return null
}

async function fetchFromLrclib(q: LyricsQuery): Promise<LyricsResult | null> {
  const durationSec = q.durationMs ? Math.round(q.durationMs / 1000) : null

  // 1. Exact match endpoint (best quality when artist + title are known).
  if (q.artist && q.title) {
    const params = new URLSearchParams({ artist_name: q.artist, track_name: q.title })
    if (q.album) params.set('album_name', q.album)
    if (durationSec) params.set('duration', String(durationSec))
    try {
      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        headers: { 'User-Agent': UA }
      })
      if (res.ok) {
        const result = pickLyrics((await res.json()) as LrclibRecord)
        if (result) return result
      }
    } catch {
      /* network failure — fall through to search */
    }
  }

  // 2. Fuzzy search fallback, preferring synced lyrics with the closest duration.
  if (!q.title) return null
  const params = new URLSearchParams({ track_name: q.title })
  if (q.artist) params.set('artist_name', q.artist)
  try {
    const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
      headers: { 'User-Agent': UA }
    })
    if (res.ok) {
      const list = (await res.json()) as LrclibRecord[]
      if (Array.isArray(list) && list.length > 0) {
        const best = [...list].sort((a, b) => {
          const synced = Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics)
          if (synced !== 0) return synced
          if (!durationSec) return 0
          return (
            Math.abs((a.duration ?? 0) - durationSec) - Math.abs((b.duration ?? 0) - durationSec)
          )
        })[0]
        return pickLyrics(best)
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

export async function getLyrics(q: LyricsQuery): Promise<LyricsResult | null> {
  // Prefer a subtitle/lyrics file beside the audio over any cached or remote result.
  // Sidecars are intentionally not cached here so a changed file is picked up on
  // the next renderer request.
  const sidecar = await readSidecar(q.path)
  if (sidecar) return sidecar

  if (!q.title) return null

  const key = signature(q)
  if (memCache.has(key)) return memCache.get(key) ?? null

  const dir = lyricsDir()
  const file = join(dir, `${key}.json`)

  // Disk cache hit
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as
      | { notFound: true }
      | { synced: string | null; plain: string | null }
    if ('notFound' in raw) {
      memCache.set(key, null)
      return null
    }
    const result = { synced: raw.synced ?? null, plain: raw.plain ?? null }
    memCache.set(key, result)
    return result
  } catch {
    /* fall through to network */
  }

  const result = await fetchFromLrclib(q)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(file, JSON.stringify(result ?? { notFound: true }))
  } catch (err) {
    console.error('Failed to cache lyrics:', err)
  }
  memCache.set(key, result)
  return result
}
