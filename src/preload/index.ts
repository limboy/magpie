import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

const soundbox = {
  openFolder: () => ipcRenderer.invoke('soundbox:openFolder') as Promise<string | null>,
  readTree: (root: string) => ipcRenderer.invoke('soundbox:readTree', root),
  probeDuration: (path: string) =>
    ipcRenderer.invoke('soundbox:probeDuration', path) as Promise<number | null>,
  probeMetadata: (path: string) =>
    ipcRenderer.invoke('soundbox:probeMetadata', path) as Promise<{
      artist: string
      album: string
      title: string
    } | null>,
  getCoverArt: (path: string) =>
    ipcRenderer.invoke('soundbox:getCoverArt', path) as Promise<string | null>,
  getLyrics: (query: import('./soundbox').LyricsQuery) =>
    ipcRenderer.invoke('soundbox:getLyrics', query) as Promise<
      import('./soundbox').LyricsResult | null
    >,
  getBulkMetadata: (paths: string[]) =>
    ipcRenderer.invoke('soundbox:getBulkMetadata', paths) as Promise<
      Record<
        string,
        { meta: { artist: string; album: string; title: string }; duration: number | null }
      >
    >,
  signalReady: () => ipcRenderer.send('soundbox:renderer-ready'),
  setFullPlayer: (full: boolean) => ipcRenderer.send('soundbox:set-full-player', full),
  getState: () => ipcRenderer.invoke('soundbox:getState'),
  setState: (patch: Partial<import('./soundbox').AppState>) =>
    ipcRenderer.invoke('soundbox:setState', patch),
  onLibraryChanged: (cb: (payload: { kind: 'tree'; path: string }) => void) => {
    const listener = (_: IpcRendererEvent, payload: { kind: 'tree'; path: string }): void =>
      cb(payload)
    ipcRenderer.on('soundbox:library-changed', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:library-changed', listener)
    }
  },
  onStateUpdated: (cb: (state: import('./soundbox').AppState) => void) => {
    const listener = (_: IpcRendererEvent, state: import('./soundbox').AppState): void => cb(state)
    ipcRenderer.on('soundbox:state-updated', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:state-updated', listener)
    }
  },
  getPathInfo: (path: string) =>
    ipcRenderer.invoke('soundbox:getPathInfo', path) as Promise<{
      isDirectory: boolean
      isFile: boolean
      ext: string
    } | null>,
  onPlaySong: (cb: (path: string) => void) => {
    const listener = (_: IpcRendererEvent, path: string): void => cb(path)
    ipcRenderer.on('soundbox:play-song', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:play-song', listener)
    }
  },
  revealInFinder: (path: string) => ipcRenderer.invoke('soundbox:revealInFinder', path) as Promise<void>,
  showSongContextMenu: (path: string) => ipcRenderer.invoke('soundbox:showSongContextMenu', path) as Promise<void>,
  showCollectionContextMenu: (id: string, title: string) =>
    ipcRenderer.invoke('soundbox:showCollectionContextMenu', id, title) as Promise<void>,
  showSidebarContextMenu: () =>
    ipcRenderer.invoke('soundbox:showSidebarContextMenu') as Promise<void>,
  onNewCollection: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('soundbox:new-collection', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:new-collection', listener)
    }
  },
  onRenameCollection: (cb: (id: string, title: string) => void) => {
    const listener = (_: IpcRendererEvent, id: string, title: string): void => cb(id, title)
    ipcRenderer.on('soundbox:rename-collection', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:rename-collection', listener)
    }
  },
  onDeleteCollection: (cb: (id: string, title: string) => void) => {
    const listener = (_: IpcRendererEvent, id: string, title: string): void => cb(id, title)
    ipcRenderer.on('soundbox:delete-collection', listener)
    return () => {
      ipcRenderer.removeListener('soundbox:delete-collection', listener)
    }
  },
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  update: {
    onUpdateReady: (cb: (info: { version: string }) => void) => {
      const listener = (_: IpcRendererEvent, info: { version: string }): void => cb(info)
      ipcRenderer.on('soundbox:update-ready', listener)
      return () => {
        ipcRenderer.removeListener('soundbox:update-ready', listener)
      }
    },
    apply: () => ipcRenderer.invoke('soundbox:apply-update') as Promise<void>
  }
}


if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('soundbox', soundbox)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.soundbox = soundbox
}
