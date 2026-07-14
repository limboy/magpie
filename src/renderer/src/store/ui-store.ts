import { create } from 'zustand'

type UIState = {
  isSearchOpen: boolean
  searchQuery: string
  showStarredOnly: boolean
  lyricsSidebarOpen: boolean
  fullPlayer: boolean
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleStarredOnly: () => void
  toggleLyricsSidebar: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  showStarredOnly: false,
  lyricsSidebarOpen: false,
  fullPlayer: false,
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStarredOnly: () => set((s) => ({ showStarredOnly: !s.showStarredOnly })),
  toggleLyricsSidebar: () => set((s) => ({ lyricsSidebarOpen: !s.lyricsSidebarOpen })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))
