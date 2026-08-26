import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { registerLocalProtocolHandler, registerLocalSchemePrivileged } from './lib/protocol'
import { readState } from './lib/store'
import { registerFsIpc } from './ipc/fs'
import { registerDialogIpc } from './ipc/dialog'
import { registerStoreIpc } from './ipc/store'
import { registerMenuIpc } from './ipc/menu'
import { flushCache } from './lib/metadata-cache'
import { closeWatcher, setupWatcher } from './lib/watcher'
import { setupApplicationMenu } from './lib/menu'
import { broadcast, createWindow, revealWindow } from './lib/windows'

registerLocalSchemePrivileged()

function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    broadcast('soundbox:update-ready', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[autoUpdater]', err)
  })

  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    6 * 60 * 60 * 1000
  )
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('me.limboy.magpie')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupApplicationMenu(() => {
    void createWindow()
  })

  registerLocalProtocolHandler()
  registerDialogIpc()
  registerFsIpc()
  registerStoreIpc()
  registerMenuIpc()

  ipcMain.handle('soundbox:apply-update', () => {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  })

  ipcMain.on('soundbox:renderer-ready', (event) => {
    revealWindow(BrowserWindow.fromWebContents(event.sender))
  })

  await readState()

  await createWindow()

  await setupWatcher()

  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  flushCache()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  flushCache()
  void closeWatcher()
})
