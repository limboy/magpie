import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import pkg from 'electron-updater'
const { autoUpdater } = pkg
import icon from '../../resources/icon.png?asset'
import { registerLocalProtocolHandler, registerLocalSchemePrivileged } from './lib/protocol'
import { readState, writeState } from './lib/store'
import { registerFsIpc } from './ipc/fs'
import { registerDialogIpc } from './ipc/dialog'
import { registerStoreIpc } from './ipc/store'
import { registerMenuIpc } from './ipc/menu'
import { flushCache } from './lib/metadata-cache'
import { closeWatcher, setupWatcher } from './lib/watcher'

registerLocalSchemePrivileged()

// Minimum window size differs per player mode: the list view needs room for
// the sidebar + track list, while the full player is a narrow, tall column.
const LIST_MIN = { width: 1000, height: 600 }
const FULL_PLAYER_MIN = { width: 400, height: 450 }

let mainWindow: BrowserWindow | null = null

// Which mode the window is currently in; determines which persisted bounds
// (windowBounds vs fullPlayerBounds) get saved and restored.
let isFullPlayer = false

function getWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function revealWindow(): void {
  const w = getWindow()
  if (w && !w.isVisible()) w.show()
}

async function createWindow(): Promise<void> {
  const state = await readState()
  const { windowBounds } = state

  mainWindow = new BrowserWindow({
    x: windowBounds?.x,
    y: windowBounds?.y,
    width: windowBounds?.width || 1200,
    height: windowBounds?.height || 800,
    minWidth: LIST_MIN.width,
    minHeight: LIST_MIN.height,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 13 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Reveal the window only once the renderer has restored its state and
  // painted the target song, so the user never sees the empty loading UI.
  // ready-to-show only arms a safety timeout in case that signal never
  // arrives (e.g. a renderer error).
  mainWindow.on('ready-to-show', () => {
    setTimeout(revealWindow, 3000)
  })

  let saveTimeout: NodeJS.Timeout | null = null
  const persistBounds = (): void => {
    const bounds = mainWindow?.getBounds()
    if (bounds) {
      void writeState(isFullPlayer ? { fullPlayerBounds: bounds } : { windowBounds: bounds })
    }
  }
  const saveBounds = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(persistBounds, 500)
  }

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  mainWindow.on('close', () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    persistBounds()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcastToAllWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    broadcastToAllWindows('soundbox:update-ready', { version: info.version })
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
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerLocalProtocolHandler()
  registerDialogIpc(getWindow)
  registerFsIpc()
  registerStoreIpc()
  registerMenuIpc(getWindow)

  ipcMain.handle('soundbox:apply-update', () => {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  })

  ipcMain.on('soundbox:renderer-ready', () => revealWindow())

  ipcMain.on('soundbox:set-full-player', async (_e, full: boolean) => {
    const w = getWindow()
    if (!w || full === isFullPlayer) return

    // Persist the bounds of the mode we're leaving so it can be restored next time.
    await writeState(
      isFullPlayer ? { fullPlayerBounds: w.getBounds() } : { windowBounds: w.getBounds() }
    )

    isFullPlayer = full

    // Apply the target mode's minimum, then snap to its last-used bounds (if any).
    const min = full ? FULL_PLAYER_MIN : LIST_MIN
    w.setMinimumSize(min.width, min.height)

    const state = await readState()
    const target = full ? state.fullPlayerBounds : state.windowBounds
    if (target) w.setBounds(target)
  })

  await readState()

  await createWindow()

  await setupWatcher(getWindow)

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
