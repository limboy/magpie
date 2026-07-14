import { create } from 'zustand'

type UIState = {
  foldersPageOpen: boolean
  isSearchOpen: boolean
  searchQuery: string
  showStarredOnly: boolean
  lyricsSidebarOpen: boolean
  fullPlayer: boolean
  toggleFoldersPage: () => void
  setFoldersPageOpen: (open: boolean) => void
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleStarredOnly: () => void
  toggleLyricsSidebar: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  foldersPageOpen: false,
  isSearchOpen: false,
  searchQuery: '',
  showStarredOnly: false,
  lyricsSidebarOpen: false,
  fullPlayer: false,
  toggleFoldersPage: () => set((s) => ({ foldersPageOpen: !s.foldersPageOpen })),
  setFoldersPageOpen: (foldersPageOpen) => set({ foldersPageOpen }),
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStarredOnly: () => set((s) => ({ showStarredOnly: !s.showStarredOnly })),
  toggleLyricsSidebar: () => set((s) => ({ lyricsSidebarOpen: !s.lyricsSidebarOpen })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))
