import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { readState, writeState } from './store'

const PLAYER_SIZE = { width: 410, height: 720 }
// Each extra window opens down-right of the one it was spawned from, the way
// Finder cascades new windows.
const CASCADE_OFFSET = 28

// Only one window persists its geometry, otherwise every cascaded window would
// overwrite the saved bounds and the app would creep across the screen a little
// further on each launch. Ownership passes to a surviving window on close.
let boundsOwner: BrowserWindow | null = null

export function getFocusedWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused
  const [first] = BrowserWindow.getAllWindows()
  return first && !first.isDestroyed() ? first : null
}

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

export function broadcastExcept(senderId: number, channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents.id === senderId) continue
    win.webContents.send(channel, ...args)
  }
}

export function revealWindow(win: BrowserWindow | null): void {
  if (win && !win.isDestroyed() && !win.isVisible()) win.show()
}

type Bounds = { x?: number; y?: number; width: number; height: number }

function nextBounds(saved: Bounds | undefined): Bounds {
  const open = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed())
  if (open.length === 0) {
    return {
      x: saved?.x,
      y: saved?.y,
      width: saved?.width ?? PLAYER_SIZE.width,
      height: saved?.height ?? PLAYER_SIZE.height
    }
  }

  // Cascade off whichever window spawned this one.
  const reference = getFocusedWindow() ?? open[open.length - 1]
  const from = reference.getContentBounds()
  const area = screen.getDisplayMatching(reference.getBounds()).workArea
  let x = from.x + CASCADE_OFFSET
  let y = from.y + CASCADE_OFFSET
  if (x + from.width > area.x + area.width || y + from.height > area.y + area.height) {
    x = area.x + CASCADE_OFFSET
    y = area.y + CASCADE_OFFSET
  }
  return { x, y, width: from.width, height: from.height }
}

function trackBounds(win: BrowserWindow): void {
  if (!boundsOwner || boundsOwner.isDestroyed()) boundsOwner = win

  let saveTimeout: NodeJS.Timeout | null = null
  const persistBounds = (): void => {
    if (boundsOwner !== win || win.isDestroyed()) return
    const bounds = win.getBounds()
    void writeState({
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    })
  }
  const saveBounds = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(persistBounds, 500)
  }

  win.on('move', saveBounds)
  win.on('resize', saveBounds)
  win.on('close', () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    persistBounds()
  })
  win.on('closed', () => {
    if (boundsOwner !== win) return
    boundsOwner = null
    const survivor = BrowserWindow.getAllWindows().find((other) => !other.isDestroyed())
    if (survivor) boundsOwner = survivor
  })
}

export async function createWindow(): Promise<BrowserWindow> {
  const state = await readState()
  const bounds = nextBounds(state.windowBounds)

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 400,
    minHeight: 562,
    maxWidth: 800,
    useContentSize: true,
    resizable: true,
    maximizable: true,
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
  win.on('ready-to-show', () => {
    setTimeout(() => revealWindow(win), 3000)
  })

  trackBounds(win)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
