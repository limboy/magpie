import { BrowserWindow, dialog, ipcMain } from 'electron'

export function registerDialogIpc(): void {
  ipcMain.handle('soundbox:openFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts: Electron.OpenDialogOptions = {
      title: 'Select audio folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
