import { ipcMain } from 'electron'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { parseFile } from 'music-metadata'
import { readTree } from '../lib/scan'

import { getCachedMetadata, setCachedMetadata } from '../lib/metadata-cache'
import { getCoverArt } from '../lib/cover-cache'
import { getLyrics, type LyricsQuery } from '../lib/lyrics-cache'

export function registerFsIpc(): void {
  ipcMain.handle('soundbox:readTree', async (_e, root: string) => {
    return readTree(root)
  })

  ipcMain.handle('soundbox:probeDuration', async (_e, path: string) => {
    const cached = await getCachedMetadata(path)
    if (cached !== null) return cached.duration

    try {
      const meta = await parseFile(path, { duration: true, skipCovers: true })
      const ms =
        typeof meta.format.duration === 'number' ? Math.round(meta.format.duration * 1000) : null

      const artist =
        meta.common.artist ||
        meta.common.albumartist ||
        (meta.common.artists && meta.common.artists[0]) ||
        'Unknown'
      const album = meta.common.album || 'Unknown'
      const title = meta.common.title || 'Unknown'

      await setCachedMetadata(path, {
        duration: ms,
        artist: artist.trim(),
        album: album.trim(),
        title: title.trim()
      })

      return ms
    } catch {
      return null
    }
  })
  ipcMain.handle('soundbox:getCoverArt', async (_e, path: string) => {
    return getCoverArt(path)
  })

  ipcMain.handle('soundbox:getLyrics', async (_e, query: LyricsQuery) => {
    return getLyrics(query)
  })

  ipcMain.handle('soundbox:getPathInfo', async (_e, path: string) => {
    try {
      const s = await stat(path)
      return {
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        ext: extname(path).toLowerCase()
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('soundbox:getBulkMetadata', async (_e, paths: string[]) => {
    const result: Record<
      string,
      { meta: { artist: string; album: string; title: string }; duration: number | null }
    > = {}
    for (const path of paths) {
      const cached = await getCachedMetadata(path)
      if (cached) {
        result[path] = {
          meta: {
            artist: cached.artist,
            album: cached.album,
            title: cached.title
          },
          duration: cached.duration
        }
      }
    }
    return result
  })

  ipcMain.handle('soundbox:probeMetadata', async (_e, path: string) => {
    const cached = await getCachedMetadata(path)
    if (cached !== null) {
      return {
        artist: cached.artist,
        album: cached.album,
        title: cached.title
      }
    }

    try {
      const meta = await parseFile(path, { duration: true, skipCovers: true })

      const artist = (
        meta.common.artist ||
        meta.common.albumartist ||
        (meta.common.artists && meta.common.artists[0]) ||
        'Unknown'
      ).trim()
      const album = (meta.common.album || 'Unknown').trim()
      const title = (meta.common.title || 'Unknown').trim()
      const ms =
        typeof meta.format.duration === 'number' ? Math.round(meta.format.duration * 1000) : null

      await setCachedMetadata(path, {
        duration: ms,
        artist,
        album,
        title
      })

      return {
        artist,
        album,
        title
      }
    } catch {
      return null
    }
  })
}

export function clearDurationCache(): void {
  // durationCache.clear()
}
