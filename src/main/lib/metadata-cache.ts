import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'

export interface MetadataCacheEntry {
  artist: string
  album: string
  title: string
  duration: number | null
  mtime: number
  size: number
}

const CACHE_FILE_NAME = 'metadata-cache.json'
let cache: Record<string, MetadataCacheEntry> = {}
let cacheLoaded = false
let loadPromise: Promise<void> | null = null
let saveTimeout: NodeJS.Timeout | null = null

async function ensureCacheLoaded(): Promise<void> {
  if (cacheLoaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const cachePath = join(app.getPath('userData'), CACHE_FILE_NAME)
    try {
      const data = await readFile(cachePath, 'utf8')
      cache = JSON.parse(data)
    } catch {
      cache = {}
    }
    cacheLoaded = true
    loadPromise = null
  })()

  return loadPromise
}

function saveCacheDebounced(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    saveTimeout = null
    const cachePath = join(app.getPath('userData'), CACHE_FILE_NAME)
    try {
      await mkdir(app.getPath('userData'), { recursive: true })
      await writeFile(cachePath, JSON.stringify(cache, null, 1), 'utf8')
    } catch (err) {
      console.error('Failed to save metadata cache:', err)
    }
  }, 1000)
}

export async function flushCache(): Promise<void> {
  if (!cacheLoaded) return
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const cachePath = join(app.getPath('userData'), CACHE_FILE_NAME)
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(cachePath, JSON.stringify(cache, null, 1), 'utf8')
  } catch (err) {
    console.error('Failed to flush metadata cache:', err)
  }
}

export async function getCachedMetadata(path: string): Promise<MetadataCacheEntry | null> {
  await ensureCacheLoaded()
  const entry = cache[path]
  if (!entry) return null

  try {
    const s = await stat(path)
    // Use a small tolerance for mtime because some filesystems have different precision
    if (Math.abs(s.mtimeMs - entry.mtime) > 1 || s.size !== entry.size) {
      return null // Stale cache
    }
    return entry
  } catch {
    return null
  }
}

export async function setCachedMetadata(
  path: string,
  entry: Omit<MetadataCacheEntry, 'mtime' | 'size'>
): Promise<void> {
  await ensureCacheLoaded()
  try {
    const s = await stat(path)
    cache[path] = {
      ...entry,
      mtime: s.mtimeMs,
      size: s.size
    }
    saveCacheDebounced()
  } catch (err) {
    console.error('Failed to set cached metadata:', err)
  }
}
