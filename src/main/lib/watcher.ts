import { watch, FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { extname, sep } from 'node:path'
import { AppState, readState, writeState } from './store'
import { AUDIO_EXTS, TreeNode, readTree } from './scan'

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isCaseInsensitive = isMac || isWin

function normalize(p: string): string {
  return isCaseInsensitive ? p.toLowerCase() : p
}

function pathIncludes(arr: string[], p: string): boolean {
  const np = normalize(p)
  return arr.some((item) => normalize(item) === np)
}

function isInsideFolder(filePath: string, folder: string): boolean {
  const f = normalize(folder)
  const withSep = f.endsWith(sep) ? f : f + sep
  return normalize(filePath).startsWith(withSep)
}

let watcher: FSWatcher | null = null
let watchedPaths = new Set<string>()
const folderToCollections = new Map<string, string[]>()

export async function setupWatcher(getWindow: () => BrowserWindow | null): Promise<void> {
  const state = await readState()

  if (!watcher) {
    watcher = watch([], {
      persistent: true,
      ignoreInitial: true
    })
    setupHandlers(getWindow)
  }

  updateWatcher(state)
  await syncWatchedFolders(getWindow)
}

export async function closeWatcher(): Promise<void> {
  if (!watcher) return
  await watcher.close()
  watcher = null
  watchedPaths = new Set()
  folderToCollections.clear()
}

async function syncWatchedFolders(getWindow: () => BrowserWindow | null): Promise<void> {
  const state = await readState()
  let changed = false
  const nextCollections = [...state.collections]

  for (let i = 0; i < nextCollections.length; i++) {
    const c = nextCollections[i]
    if (!c.watchedFolders || c.watchedFolders.length === 0) continue

    const allFoundFiles: string[] = []
    for (const folder of c.watchedFolders) {
      if (!existsSync(folder)) continue
      try {
        const tree = await readTree(folder)
        const flatten = (n: TreeNode): void => {
          if (n.kind === 'audio') allFoundFiles.push(n.path)
          else if (n.kind === 'dir') n.children.forEach(flatten)
        }
        flatten(tree)
      } catch (err) {
        console.error(`Failed to sync folder ${folder}:`, err)
      }
    }

    const excluded = c.excludedPaths || []
    const missingFiles = allFoundFiles.filter(
      (f) => !pathIncludes(c.items, f) && !pathIncludes(excluded, f)
    )
    if (missingFiles.length > 0) {
      changed = true
      nextCollections[i] = { ...c, items: [...c.items, ...missingFiles] }
    }
  }

  if (changed) {
    const nextState = await writeState({ collections: nextCollections })
    updateWatcher(nextState)
    const win = getWindow()
    if (win) {
      win.webContents.send('soundbox:state-updated', nextState)
    }
  }
}

export function updateWatcher(state: AppState): void {
  const standaloneFiles = new Set<string>()
  const watchedFolders = new Set<string>()
  folderToCollections.clear()

  for (const collection of state.collections) {
    if (!collection.watchedFolders) continue
    for (const folder of collection.watchedFolders) {
      watchedFolders.add(folder)
      const current = folderToCollections.get(folder) || []
      if (!current.includes(collection.id)) {
        folderToCollections.set(folder, [...current, collection.id])
      }
    }
  }

  for (const collection of state.collections) {
    for (const item of collection.items) {
      const inWatched = Array.from(watchedFolders).some((f) => isInsideFolder(item, f))
      if (!inWatched) standaloneFiles.add(item)
    }
  }

  const allPaths = new Set([...standaloneFiles, ...watchedFolders])

  if (!watcher) return

  const toAdd = Array.from(allPaths).filter((p) => !watchedPaths.has(p))
  const toRemove = Array.from(watchedPaths).filter((p) => !allPaths.has(p))

  if (toAdd.length > 0) watcher.add(toAdd)
  if (toRemove.length > 0) watcher.unwatch(toRemove)

  watchedPaths = allPaths
}

function setupHandlers(getWindow: () => BrowserWindow | null): void {
  if (!watcher) return

  const removedPaths = new Set<string>()
  let timeout: NodeJS.Timeout | null = null
  let firstUnlinkAt: number | null = null
  const DEBOUNCE_MS = 500
  const MAX_WAIT_MS = 3000

  const scheduleFlush = (): void => {
    if (timeout) clearTimeout(timeout)
    const elapsed = firstUnlinkAt ? Date.now() - firstUnlinkAt : 0
    const delay = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed))
    timeout = setTimeout(flushRemovals, delay)
  }

  const flushRemovals = async (): Promise<void> => {
    const pathsToProcess = Array.from(removedPaths).filter((p) => !existsSync(p))
    removedPaths.clear()
    timeout = null
    firstUnlinkAt = null

    if (pathsToProcess.length === 0) return

    const currentState = await readState()
    let changed = false
    const nextCollections = currentState.collections.map((c) => {
      const filtered = c.items.filter((item) => !pathIncludes(pathsToProcess, item))
      if (filtered.length !== c.items.length) {
        changed = true
        return { ...c, items: filtered }
      }
      return c
    })

    let nextLastAudioPath = currentState.lastAudioPath
    if (nextLastAudioPath && pathIncludes(pathsToProcess, nextLastAudioPath)) {
      nextLastAudioPath = null
      changed = true
    }

    let nextLastAudioByCollection = currentState.lastAudioByCollection
    if (nextLastAudioByCollection) {
      const updatedMap = { ...nextLastAudioByCollection }
      let mapChanged = false
      for (const [cid, path] of Object.entries(updatedMap)) {
        if (pathIncludes(pathsToProcess, path)) {
          delete updatedMap[cid]
          mapChanged = true
        }
      }
      if (mapChanged) {
        nextLastAudioByCollection = updatedMap
        changed = true
      }
    }

    const nextLikedPaths = { ...(currentState.likedPaths || {}) }
    for (const p of pathsToProcess) {
      // Since pathsToProcess are absolute paths and likedPaths keys are normalized
      // we should be careful. store.ts uses normalizePath which resolves and lowercases (except linux).
      // pathIncludes also uses normalize.
      // Let's just iterate and check.
      const np = normalize(p)
      for (const likedPath of Object.keys(nextLikedPaths)) {
        if (normalize(likedPath) === np) {
          delete nextLikedPaths[likedPath]
          changed = true
        }
      }
    }

    if (changed) {
      const nextState = await writeState({
        collections: nextCollections,
        lastAudioPath: nextLastAudioPath,
        lastAudioByCollection: nextLastAudioByCollection,
        likedPaths: nextLikedPaths
      })
      updateWatcher(nextState)
      const win = getWindow()
      if (win) {
        win.webContents.send('soundbox:state-updated', nextState)
      }
    }
  }

  watcher.on('unlink', (path) => {
    removedPaths.add(path)
    if (!firstUnlinkAt) firstUnlinkAt = Date.now()
    scheduleFlush()
  })

  watcher.on('add', async (path) => {
    if (removedPaths.has(path)) {
      removedPaths.delete(path)
    }

    const ext = extname(path).toLowerCase()
    if (!AUDIO_EXTS.has(ext)) return

    const state = await readState()
    const alreadyIn = state.collections.some((c) => pathIncludes(c.items, path))
    if (alreadyIn) return

    const targetCollectionIds = new Set<string>()
    for (const [folder, collectionIds] of folderToCollections.entries()) {
      if (!isInsideFolder(path, folder)) continue
      for (const cid of collectionIds) {
        const collection = state.collections.find((c) => c.id === cid)
        if (!collection) continue
        if (pathIncludes(collection.excludedPaths || [], path)) continue
        targetCollectionIds.add(cid)
      }
    }

    if (targetCollectionIds.size === 0) return

    let changed = false
    const nextCollections = state.collections.map((c) => {
      if (targetCollectionIds.has(c.id) && !pathIncludes(c.items, path)) {
        changed = true
        return { ...c, items: [...c.items, path] }
      }
      return c
    })

    if (changed) {
      const nextState = await writeState({ collections: nextCollections })
      updateWatcher(nextState)
      const win = getWindow()
      if (win) {
        win.webContents.send('soundbox:state-updated', nextState)
      }
    }
  })
}
