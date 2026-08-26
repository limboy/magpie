import { ipcMain } from 'electron'
import { AppState, readState, writeState } from '../lib/store'
import { updateWatcher } from '../lib/watcher'
import { broadcastExcept } from '../lib/windows'

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
}
