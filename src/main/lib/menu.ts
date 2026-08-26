import { Menu, MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'

// The app ships without a visible menu bar on Windows/Linux (autoHideMenuBar),
// but the menu still owns the accelerators — Cmd/Ctrl+N included.
export function setupApplicationMenu(onNewWindow: () => void): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => onNewWindow()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    ...(is.dev
      ? [
          {
            label: 'View',
            submenu: [
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' }
            ] as MenuItemConstructorOptions[]
          }
        ]
      : []),
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
