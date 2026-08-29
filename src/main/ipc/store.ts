import { ipcMain } from 'electron'
import { AppState, readState, writeState } from '../lib/store'
import { updateWatcher } from '../lib/watcher'
import { broadcast, broadcastExcept } from '../lib/windows'

export function registerStoreIpc(): void {
  ipcMain.handle('soundbox:getState', async () => readState())
  ipcMain.handle('soundbox:setState', async (event, patch: Partial<AppState>) => {
    const next = await writeState(patch)
    updateWatcher(next)
    // Other windows share the same library, so keep them in step — otherwise a
    // window holding a stale copy would clobber the change on its next write.
    broadcastExcept(event.sender.id, 'soundbox:state-updated', next)
    return next
  })
  // Counted here rather than in the renderer so the increment is atomic. A
  // window that sent the whole map would build it from its own snapshot and
  // drop a count another window recorded in the meantime. Every window hears
  // the result, including the sender, so the optimistic bump it already made
  // settles on the authoritative number.
  ipcMain.handle('soundbox:incrementPlayCount', async (_event, path: string) => {
    const current = await readState()
    if (typeof path !== 'string' || !path) return current
    const playCounts = { ...(current.playCounts || {}) }
    playCounts[path] = (playCounts[path] ?? 0) + 1
    const next = await writeState({ playCounts })
    broadcast('soundbox:state-updated', next)
    return next
  })
}
