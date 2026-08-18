import { create } from 'zustand'
import type { AudioMark } from '../../../preload/soundbox'
import { nextAudioMark } from '@/lib/audio-mark'

export type MainView = 'list' | 'folders' | 'lyrics'

// What the cover panel (above the transport controls) is currently showing.
// Cover art and lyrics share the same panel, so only one can be active.
export type CoverPanelView = 'cover' | 'lyrics' | 'hidden'

type UIState = {
  isSearchOpen: boolean
  searchQuery: string
  markFilter: AudioMark | null
  mainView: MainView
  fullPlayer: boolean
  coverPanelView: CoverPanelView
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  cycleMarkFilter: () => void
  setMainView: (view: MainView) => void
  toggleFoldersView: () => void
  toggleLyricsView: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
  toggleCoverPanelCover: () => void
  toggleCoverPanelLyrics: () => void
}

export const useUI = create<UIState>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  markFilter: null,
  mainView: 'list',
  fullPlayer: false,
  coverPanelView: 'cover',
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  cycleMarkFilter: () => set((s) => ({ markFilter: nextAudioMark(s.markFilter) })),
  setMainView: (mainView) => set({ mainView }),
  toggleFoldersView: () =>
    set((s) => ({ mainView: s.mainView === 'folders' ? 'list' : 'folders' })),
  toggleLyricsView: () => set((s) => ({ mainView: s.mainView === 'lyrics' ? 'list' : 'lyrics' })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer }),
  toggleCoverPanelCover: () =>
    set((s) => ({ coverPanelView: s.coverPanelView === 'cover' ? 'hidden' : 'cover' })),
  toggleCoverPanelLyrics: () =>
    set((s) => ({ coverPanelView: s.coverPanelView === 'lyrics' ? 'hidden' : 'lyrics' }))
}))
