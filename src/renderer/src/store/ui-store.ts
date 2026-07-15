import { create } from 'zustand'

export type SidebarPanel = 'folders' | 'lyrics' | null

type UIState = {
  isSearchOpen: boolean
  searchQuery: string
  showStarredOnly: boolean
  sidebarPanel: SidebarPanel
  fullPlayer: boolean
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleStarredOnly: () => void
  toggleFoldersSidebar: () => void
  toggleLyricsSidebar: () => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  showStarredOnly: false,
  sidebarPanel: null,
  fullPlayer: false,
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleStarredOnly: () => set((s) => ({ showStarredOnly: !s.showStarredOnly })),
  toggleFoldersSidebar: () =>
    set((s) => ({ sidebarPanel: s.sidebarPanel === 'folders' ? null : 'folders' })),
  toggleLyricsSidebar: () =>
    set((s) => ({ sidebarPanel: s.sidebarPanel === 'lyrics' ? null : 'lyrics' })),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))
