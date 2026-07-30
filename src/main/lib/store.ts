import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export type CollectionType = 'Music' | 'Audio Book'
export type Collection = {
  id: string
  title: string
  type: CollectionType
  items: string[] // Array of file paths
  watchedFolders?: string[]
  excludedPaths?: string[]
}

export type AppState = {
  collections: Collection[]
  selectedCollectionId: string | null
  lastAudioPath: string | null
  lastAudioPositionMs?: number
  lastAudioPositions?: Record<string, number>
  lastAudioByCollection?: Record<string, string>
  likedPaths?: Record<string, number>
  // Bounds for list mode.
  windowBounds?: {
    x?: number
    y?: number
    width: number
    height: number
  }
  // Bounds for full player mode, remembered independently from list mode.
  fullPlayerBounds?: {
    x?: number
    y?: number
    width: number
    height: number
  }
}

const DEFAULT: AppState = {
  collections: [],
  selectedCollectionId: null,
  lastAudioPath: null,
  lastAudioPositionMs: 0,
  lastAudioPositions: {},
  lastAudioByCollection: {}
}

let cached: AppState | null = null
const authorizedPaths = new Set<string>()

function storePath(): string {
  return join(app.getPath('userData'), 'soundbox.json')
}

function normalizePath(p: string): string {
  const n = resolve(p)
  return process.platform !== 'linux' ? n.toLowerCase() : n
}

function updateAuthorizedPaths(state: AppState): void {
  authorizedPaths.clear()
  for (const c of state.collections) {
    if (c.items) {
      for (const item of c.items) {
        authorizedPaths.add(normalizePath(item))
      }
    }
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}

export async function readState(): Promise<AppState> {
  if (cached) return cached
  const path = storePath()
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppState>
    cached = { ...DEFAULT, ...parsed }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.error('Failed to read state file, it might be corrupted:', err)
    }
    cached = { ...DEFAULT }
  }
  updateAuthorizedPaths(cached)
  return cached
}

let writeQueue = Promise.resolve()

export async function writeState(patch: Partial<AppState>): Promise<AppState> {
  const current = await readState()
  const next = { ...current, ...patch }
  const collectionsChanged = patch.collections !== undefined

  cached = next
  if (collectionsChanged) {
    updateAuthorizedPaths(cached)
  }

  const promise = writeQueue.then(async () => {
    const path = storePath()
    const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      await ensureDir(path)
      await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
      await rename(tmp, path)
    } catch (err) {
      console.error('Failed to write state:', err)
    }
  })

  writeQueue = promise
  await promise
  return next
}

export function isAuthorizedPath(path: string): boolean {
  return authorizedPaths.has(normalizePath(path))
}
