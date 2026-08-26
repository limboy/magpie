import { ipcMain, Menu, shell, BrowserWindow } from 'electron'
import { resolve, normalize } from 'node:path'

export function registerMenuIpc(): void {
  ipcMain.handle('soundbox:revealInFinder', async (_e, path: string) => {
    shell.showItemInFolder(normalize(resolve(path)))
  })

  ipcMain.handle(
    'soundbox:showSongContextMenu',
    async (event, path: string, selectedPaths: string[]) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      const normalizedPath = normalize(resolve(path))
      const requestedPaths = Array.isArray(selectedPaths) ? selectedPaths : [path]
      const pathsToRemove = Array.from(
        new Set(requestedPaths.filter((selectedPath) => typeof selectedPath === 'string'))
      )
      if (pathsToRemove.length === 0) pathsToRemove.push(path)
      const removeLabel =
        pathsToRemove.length === 1
          ? 'Remove from Playlist'
          : `Remove ${pathsToRemove.length} Songs from Playlist`

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
        },
        { type: 'separator' },
        {
          label: removeLabel,
          click: () => {
            win.webContents.send('soundbox:remove-songs', pathsToRemove)
          }
        }
      ])

      menu.popup({ window: win })
    }
  )

  ipcMain.handle('soundbox:showSidebarContextMenu', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
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

  ipcMain.handle('soundbox:showCollectionContextMenu', async (event, id: string, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
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
