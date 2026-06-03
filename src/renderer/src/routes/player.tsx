import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeft, Search, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TwoPane } from '@/components/layout/two-pane'
import { FileTree } from '@/components/file-tree/file-tree'
import { AudioList } from '@/components/player/audio-list'
import { AudioPlayer } from '@/components/player/audio-player'
import { LyricsSidebar } from '@/components/player/lyrics-sidebar'
import { UpdateIndicator } from '@/components/update-indicator'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'

export function PlayerRoute(): React.JSX.Element {
  const setCollections = useLibrary((s) => s.setCollections)
  const selectCollection = useLibrary((s) => s.selectCollection)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const setLikedPaths = useLibrary((s) => s.setLikedPaths)
  const setBulkTrackInfo = useLibrary((s) => s.setBulkTrackInfo)
  const setHydrated = useLibrary((s) => s.setHydrated)

  const leftSidebarOpen = useUI((s) => s.leftSidebarOpen)
  const leftSidebarWidth = useUI((s) => s.leftSidebarWidth)
  const setLeftSidebarOpen = useUI((s) => s.setLeftSidebarOpen)
  const setLeftSidebarWidth = useUI((s) => s.setLeftSidebarWidth)
  const isSearchOpen = useUI((s) => s.isSearchOpen)
  const searchQuery = useUI((s) => s.searchQuery)
  const setIsSearchOpen = useUI((s) => s.setIsSearchOpen)
  const setSearchQuery = useUI((s) => s.setSearchQuery)
  const showStarredOnly = useUI((s) => s.showStarredOnly)
  const toggleStarredOnly = useUI((s) => s.toggleStarredOnly)
  const lyricsSidebarOpen = useUI((s) => s.lyricsSidebarOpen)
  const fullPlayer = useUI((s) => s.fullPlayer)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isCompact, setIsCompact] = useState(window.innerWidth < 500)

  useEffect(() => {
    const handleResize = (): void => {
      const compact = window.innerWidth < 500
      setIsCompact(compact)

      if (compact) {
        setLeftSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [setLeftSidebarOpen])

  useEffect(() => {
    void (async () => {
      const state = await window.soundbox.getState()

      // Prefetch cached metadata for the collection we're about to show so the
      // list paints with parsed titles directly, instead of flashing filenames
      // first and switching once AudioList's own fetch resolves.
      const selected = state.collections?.find((c) => c.id === state.selectedCollectionId)
      const items = selected?.items ?? []
      if (items.length > 0) {
        const bulk = await window.soundbox.getBulkMetadata(items).catch(() => ({}))
        setBulkTrackInfo(bulk)
      }

      if (state.collections) {
        setCollections(state.collections)
      }
      if (state.selectedCollectionId) {
        selectCollection(state.selectedCollectionId)
      }
      // Select the restored track in the same batch so the player paints the
      // target song directly, rather than flashing the collection's first
      // track (or "Ready to play") before switching.
      if (state.lastAudioPath) {
        selectAudio(state.lastAudioPath)
      }
      if (state.likedPaths) {
        setLikedPaths(state.likedPaths)
      }
      // Restore is done: only now should the player fall back to "Ready to
      // play" when there's genuinely nothing to show.
      setHydrated(true)
    })()
  }, [setCollections, selectCollection, selectAudio, setLikedPaths, setBulkTrackInfo, setHydrated])

  const hydrated = useLibrary((s) => s.hydrated)
  useEffect(() => {
    if (!hydrated) return
    // Tell the main process to reveal the window only after the restored UI
    // has actually painted (a double rAF lands after the next commit's paint),
    // so the window appears already showing the song — no loading flash.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => window.soundbox.signalReady())
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [hydrated])

  useEffect(() => {
    return window.soundbox.onStateUpdated((state) => {
      const prev = useLibrary.getState()
      setCollections(state.collections)
      if (state.selectedCollectionId !== prev.selectedCollectionId) {
        useLibrary.setState({ selectedCollectionId: state.selectedCollectionId })
      }
      if (state.lastAudioPath !== prev.selectedAudio) {
        selectAudio(state.lastAudioPath)
      }
      if (state.likedPaths) {
        setLikedPaths(state.likedPaths)
      }
    })
  }, [setCollections, selectAudio, setLikedPaths])

  const toggleLeft = useCallback(() => {
    setLeftSidebarOpen(!leftSidebarOpen)
  }, [leftSidebarOpen, setLeftSidebarOpen])

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus()
    }
  }, [isSearchOpen])

  const leftOpen = !isCompact && leftSidebarOpen

  return (
    <div className="relative flex h-screen overflow-hidden">
      <TwoPane
        leftOpen={leftOpen}
        leftWidth={leftSidebarWidth}
        onLeftWidthChange={setLeftSidebarWidth}
        left={<FileTree />}
        center={
          <div className="flex h-full min-w-0 flex-1 flex-col">
            {/* Global Top Navigation Bar */}
            <header className="app-drag flex h-10 shrink-0 items-center justify-end border-b bg-background/80 backdrop-blur-sm px-3">
              {/* Right: Update indicator + Search */}
              <div className="flex items-center gap-2 app-no-drag">
                <UpdateIndicator />
                {!fullPlayer && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn('size-7', showStarredOnly && 'text-primary hover:text-primary')}
                    onClick={toggleStarredOnly}
                    aria-label="Show starred only"
                    aria-pressed={showStarredOnly}
                  >
                    <Star className={cn('size-4', showStarredOnly && 'fill-primary')} />
                  </Button>
                )}
                {!fullPlayer &&
                  (isSearchOpen ? (
                    <div className="flex items-center bg-muted/50 rounded-md px-2 py-1 h-7 border border-border/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                      <Search className="size-3.5 text-muted-foreground mr-1.5" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search songs..."
                        className="bg-transparent border-none outline-none text-xs w-32 md:w-48 placeholder:text-muted-foreground/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setIsSearchOpen(false)
                          }
                        }}
                      />
                      <button
                        className="hover:text-foreground text-muted-foreground transition-colors ml-1"
                        onClick={() => setIsSearchOpen(false)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setIsSearchOpen(true)}
                      aria-label="Search"
                    >
                      <Search className="size-4" />
                    </Button>
                  ))}
              </div>
            </header>

            <PlayerCenter />
          </div>
        }
      />
      {!fullPlayer && lyricsSidebarOpen && <LyricsSidebar />}
      {/* Sidebar toggler, parked next to the macOS traffic lights. Rendered last
          so its no-drag region wins over the app-drag header/spacer underneath. */}
      {!isCompact && (
        <Button
          size="icon"
          variant="ghost"
          className="app-no-drag absolute left-21 top-1.5 z-50 size-7"
          aria-label={leftSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-pressed={leftSidebarOpen}
          onClick={toggleLeft}
        >
          <PanelLeft className="size-4 opacity-75" />
        </Button>
      )}
    </div>
  )
}

function PlayerCenter(): React.JSX.Element {
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const addItemsToSelectedCollection = useLibrary((s) => s.addItemsToSelectedCollection)
  const fullPlayer = useUI((s) => s.fullPlayer)

  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault()
    dragCounter.current++
    if (selectedCollectionId) setIsDragOver(true)
  }

  const handleDragLeave = (): void => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)
    if (!selectedCollectionId) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const paths: string[] = []
    const folderPaths: string[] = []
    for (const file of files) {
      const p = window.soundbox.getPathForFile(file)
      if (!p) continue
      const info = await window.soundbox.getPathInfo(p)
      if (!info) continue
      if (info.isFile) {
        const allowed = ['.mp3', '.m4a', '.m4b', '.flac', '.ogg', '.wav']
        if (allowed.includes(info.ext)) paths.push(p)
      } else if (info.isDirectory) {
        folderPaths.push(p)
        const tree = await window.soundbox.readTree(p)
        const flatten = (n: import('../../../preload/soundbox').TreeNode): void => {
          if (n.kind === 'audio') paths.push(n.path)
          if (n.kind === 'dir') n.children.forEach(flatten)
        }
        flatten(tree)
      }
    }
    if (paths.length > 0) addItemsToSelectedCollection(paths)
    if (folderPaths.length > 0) useLibrary.getState().addFoldersToSelectedCollection(folderPaths)
  }

  return (
    <div
      className="@container relative flex h-full w-full flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AudioPlayer fullPlayer={fullPlayer} />
      {!fullPlayer && (
        <ScrollArea className="min-h-0 flex-1">
          <AudioList />
        </ScrollArea>
      )}
      <div
        className={cn(
          'absolute inset-0 pointer-events-none z-40 transition-opacity',
          isDragOver ? 'opacity-100' : 'opacity-0',
          'bg-primary/5 ring-2 ring-inset ring-primary/20'
        )}
      />
    </div>
  )
}
