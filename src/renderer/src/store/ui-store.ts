import { create } from 'zustand'

export type MainView = 'list' | 'folders' | 'lyrics'

type UIState = {
  isSearchOpen: boolean
  searchQuery: string
  showStarredOnly: boolean
  mainView: MainView
  fullPlayer: boolean
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleStarredOnly: () => void
  setMainView: (view: MainView) => void
  toggleFoldersView: () => void
  toggleLyricsView: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  showStarredOnly: false,
  mainView: 'list',
  fullPlayer: false,
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStarredOnly: () => set((s) => ({ showStarredOnly: !s.showStarredOnly })),
  setMainView: (mainView) => set({ mainView }),
  toggleFoldersView: () =>
    set((s) => ({ mainView: s.mainView === 'folders' ? 'list' : 'folders' })),
  toggleLyricsView: () => set((s) => ({ mainView: s.mainView === 'lyrics' ? 'list' : 'lyrics' })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))
