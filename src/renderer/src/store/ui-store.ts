import { create } from 'zustand'

type UIState = {
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  isSearchOpen: boolean
  searchQuery: string
  showStarredOnly: boolean
  lyricsSidebarOpen: boolean
  fullPlayer: boolean
  toggleLeftSidebar: () => void
  setLeftSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (w: number) => void
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleStarredOnly: () => void
  toggleLyricsSidebar: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  leftSidebarOpen: true,
  leftSidebarWidth: 220,
  isSearchOpen: false,
  searchQuery: '',
  showStarredOnly: false,
  lyricsSidebarOpen: false,
  fullPlayer: false,
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
  setLeftSidebarWidth: (leftSidebarWidth) => set({ leftSidebarWidth }),
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStarredOnly: () => set((s) => ({ showStarredOnly: !s.showStarredOnly })),
  toggleLyricsSidebar: () => set((s) => ({ lyricsSidebarOpen: !s.lyricsSidebarOpen })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))
