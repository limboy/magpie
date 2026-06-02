import { create } from 'zustand'

type UIState = {
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  isSearchOpen: boolean
  searchQuery: string
  fullPlayer: boolean
  toggleLeftSidebar: () => void
  setLeftSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (w: number) => void
  setIsSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  toggleFullPlayer: () => void
  setFullPlayer: (full: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  leftSidebarOpen: true,
  leftSidebarWidth: 220,
  isSearchOpen: false,
  searchQuery: '',
  fullPlayer: false,
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
  setLeftSidebarWidth: (leftSidebarWidth) => set({ leftSidebarWidth }),
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen, searchQuery: isSearchOpen ? '' : '' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleFullPlayer: () => set((s) => ({ fullPlayer: !s.fullPlayer })),
  setFullPlayer: (fullPlayer) => set({ fullPlayer })
}))

