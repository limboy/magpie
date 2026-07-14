import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
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

const PLAYER_SIZE = { width: 410, height: 720 }

let mainWindow: BrowserWindow | null = null
let currentRightPanelWidth = 0

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
  currentRightPanelWidth = 0

  mainWindow = new BrowserWindow({
    x: windowBounds?.x,
    y: windowBounds?.y,
    width: PLAYER_SIZE.width,
    height: PLAYER_SIZE.height,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
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
      void writeState({
        windowBounds: {
          x: bounds.x,
          y: bounds.y,
          width: PLAYER_SIZE.width,
          height: PLAYER_SIZE.height
        }
      })
    }
  }
  const saveBounds = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(persistBounds, 500)
  }

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

  ipcMain.on('soundbox:set-lyrics-panel-width', (_event, requestedRightWidth: number) => {
    const window = getWindow()
    if (!window) return

    const rightWidth = Math.max(0, Math.min(320, Math.round(requestedRightWidth)))
    if (rightWidth === currentRightPanelWidth) return

    const bounds = window.getBounds()
    const contentBounds = window.getContentBounds()
    const contentWidth = PLAYER_SIZE.width + rightWidth
    const frameWidth = bounds.width - contentBounds.width
    const width = contentWidth + frameWidth
    const workArea = screen.getDisplayMatching(bounds).workArea
    const x = Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width))

    currentRightPanelWidth = rightWidth
    window.setContentSize(contentWidth, PLAYER_SIZE.height)
    if (x !== bounds.x) window.setPosition(x, bounds.y)
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
