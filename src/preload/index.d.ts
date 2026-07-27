import { ElectronAPI } from '@electron-toolkit/preload'
import type { SoundboxApi } from './soundbox'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    soundbox: SoundboxApi
  }
}

export type { AppState, Companion, LibraryChangedPayload, SoundboxApi, TreeNode } from './soundbox'
