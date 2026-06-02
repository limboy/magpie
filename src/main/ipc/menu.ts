import { ipcMain, Menu, shell, BrowserWindow } from 'electron'
import { resolve, normalize } from 'node:path'

export function registerMenuIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('soundbox:revealInFinder', async (_e, path: string) => {
    shell.showItemInFolder(normalize(resolve(path)))
  })

  ipcMain.handle('soundbox:showSongContextMenu', async (_e, path: string) => {
    const win = getWindow()
    if (!win) return

    const normalizedPath = normalize(resolve(path))

    const menu = Menu.buildFromTemplate([
      {
        label: 'Play',
        click: () => {
          win.webContents.send('soundbox:play-song', path)
        }
      },
      { type: 'separator' },
      {
        label: 'Reveal in Finder',
        click: () => {
          shell.showItemInFolder(normalizedPath)
        }
      }
    ])

    menu.popup({ window: win })
  })

  ipcMain.handle('soundbox:showSidebarContextMenu', async () => {
    const win = getWindow()
    if (!win) return

    const menu = Menu.buildFromTemplate([
      {
        label: 'New Collection',
        click: () => {
          win.webContents.send('soundbox:new-collection')
        }
      }
    ])

    menu.popup({ window: win })
  })

  ipcMain.handle('soundbox:showCollectionContextMenu', async (_e, id: string, title: string) => {
    const win = getWindow()
    if (!win) return

    const menu = Menu.buildFromTemplate([
      {
        label: 'Rename',
        click: () => {
          win.webContents.send('soundbox:rename-collection', id, title)
        }
      },
      { type: 'separator' },
      {
        label: 'Delete',
        click: () => {
          win.webContents.send('soundbox:delete-collection', id, title)
        }
      }
    ])

    menu.popup({ window: win })
  })
}

