import { useEffect, useRef, useState } from 'react'
import { FolderPlus, PanelLeft, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from '@/components/file-tree/file-tree'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { AudioList } from '@/components/player/audio-list'
import { AudioPlayer } from '@/components/player/audio-player'
import { LyricsView } from '@/components/player/lyrics-view'
import { UpdateIndicator } from '@/components/update-indicator'
import { basename } from '@/lib/audio-extensions'
import { createCollectionFromFolder } from '@/lib/collections'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'

// The toggle clears the traffic lights while the sidebar is collapsed. Its
// expanded position includes the sidebar's one-pixel divider. A floating
// sidebar covers the collapsed spot, which is where the toggle stays — there
// is nowhere for it to go, and the scrim is what dismisses the sidebar.
const COLLAPSED_TOGGLE_LEFT = 88
const EXPANDED_TOGGLE_GAP = 9
const TOGGLE_SIZE = 28
// The song title is centred in the header, so it has to be inset by the same
// amount on both sides to stay clear of what sits on either end: the toggle
// on the left, the search button on the right. The expanded toggle overhangs
// into the sidebar, leaving only its far edge over the header.
const TITLE_INSET_EXPANDED = EXPANDED_TOGGLE_GAP + TOGGLE_SIZE + 8
const TITLE_INSET_COLLAPSED = COLLAPSED_TOGGLE_LEFT + TOGGLE_SIZE + 8

export function PlayerRoute(): React.JSX.Element {
  const setCollections = useLibrary((s) => s.setCollections)
  const setLastAudioByCollection = useLibrary((s) => s.setLastAudioByCollection)
  const setLastAudioPositions = useLibrary((s) => s.setLastAudioPositions)
  const setPlayCounts = useLibrary((s) => s.setPlayCounts)
  const selectCollection = useLibrary((s) => s.selectCollection)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const setAudioMarks = useLibrary((s) => s.setAudioMarks)
  const setBulkTrackInfo = useLibrary((s) => s.setBulkTrackInfo)
  const setHydrated = useLibrary((s) => s.setHydrated)
  const hydrated = useLibrary((s) => s.hydrated)
  const sidebarOpen = useUI((s) => s.sidebarOpen)
  const setSidebarOpen = useUI((s) => s.setSidebarOpen)
  const setSidebarFloating = useUI((s) => s.setSidebarFloating)
  const setMainView = useUI((s) => s.setMainView)
  useEffect(() => {
    void (async () => {
      const state = await window.soundbox.getState()
      const selected = state.collections?.find((c) => c.id === state.selectedCollectionId)
      const items = selected?.items ?? []

      if (items.length > 0) {
        const bulk = await window.soundbox.getBulkMetadata(items).catch(() => ({}))
        setBulkTrackInfo(bulk)
      }
      if (state.collections) setCollections(state.collections)
      if (state.lastAudioByCollection) setLastAudioByCollection(state.lastAudioByCollection)
      const positions = { ...(state.lastAudioPositions || {}) }
      if (state.lastAudioPath && typeof state.lastAudioPositionMs === 'number') {
        positions[state.lastAudioPath] = state.lastAudioPositionMs
      }
      setLastAudioPositions(positions)
      setPlayCounts(state.playCounts ?? {})
      if (state.selectedCollectionId) selectCollection(state.selectedCollectionId)
      if (state.lastAudioPath) selectAudio(state.lastAudioPath)
      const legacyStarPaths = Object.keys(state.likedPaths ?? {})
      const legacyStars = Object.fromEntries(legacyStarPaths.map((path) => [path, 'star' as const]))
      const audioMarks = { ...legacyStars, ...(state.audioMarks ?? {}) }
      setAudioMarks(audioMarks)
      if (legacyStarPaths.length > 0) {
        void window.soundbox.setState({ audioMarks, likedPaths: {} })
      }
      setHydrated(true)
    })()
  }, [
    setCollections,
    setLastAudioByCollection,
    setLastAudioPositions,
    setPlayCounts,
    selectCollection,
    selectAudio,
    setAudioMarks,
    setBulkTrackInfo,
    setHydrated
  ])

  useEffect(() => {
    if (!hydrated) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => window.soundbox.signalReady())
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [hydrated])

  // The library is shared across windows (the watcher and sibling windows both
  // push updates), but what this window is browsing and playing is its own.
  // Selection only follows the shared state when what it pointed at is gone.
  useEffect(() => {
    return window.soundbox.onStateUpdated((state) => {
      const previous = useLibrary.getState()
      setCollections(state.collections)
      if (state.lastAudioByCollection) setLastAudioByCollection(state.lastAudioByCollection)
      setPlayCounts(state.playCounts ?? {})

      const collections = state.collections ?? []
      const collectionGone =
        previous.selectedCollectionId !== null &&
        !collections.some((c) => c.id === previous.selectedCollectionId)
      if (collectionGone) {
        useLibrary.setState({ selectedCollectionId: state.selectedCollectionId })
      }

      const audioGone =
        previous.selectedAudio !== null &&
        !collections.some((c) => c.items.includes(previous.selectedAudio as string))
      if (audioGone) selectAudio(state.lastAudioPath)

      const legacyStars = Object.fromEntries(
        Object.keys(state.likedPaths ?? {}).map((path) => [path, 'star' as const])
      )
      setAudioMarks({ ...legacyStars, ...(state.audioMarks ?? {}) })
    })
  }, [setCollections, setLastAudioByCollection, setPlayCounts, selectAudio, setAudioMarks])

  return (
    <SidebarLayout
      open={sidebarOpen}
      onRequestClose={() => setSidebarOpen(false)}
      onFloatingChange={setSidebarFloating}
      sidebar={
        <>
          <SidebarHeader />
          <FileTree onSelectCollection={() => setMainView('list')} />
          <UpdateIndicator />
        </>
      }
      content={
        <>
          <ContentHeader />
          <PlayerCenter />
        </>
      }
    />
  )
}

// Clears the traffic lights and keeps the window draggable here; the
// add-folder button sits on the far right, well away from them.
function SidebarHeader(): React.JSX.Element {
  const [isPicking, setIsPicking] = useState(false)

  const handleAddFolder = async (): Promise<void> => {
    if (isPicking) return
    setIsPicking(true)
    try {
      const path = await window.soundbox.openFolder()
      if (path) await createCollectionFromFolder(path)
    } finally {
      setIsPicking(false)
    }
  }

  return (
    <div className="app-drag flex h-10 shrink-0 items-center justify-end border-b px-2">
      <Button
        size="icon"
        variant="ghost"
        className="app-no-drag size-7"
        onClick={() => void handleAddFolder()}
        disabled={isPicking}
        aria-label="Add folder as collection"
        title="Add folder as collection"
      >
        <FolderPlus className="size-3.5" />
      </Button>
    </div>
  )
}

function ContentHeader(): React.JSX.Element {
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const sidebarOpen = useUI((s) => s.sidebarOpen)
  const sidebarFloating = useUI((s) => s.sidebarFloating)
  const toggleSidebar = useUI((s) => s.toggleSidebar)
  const isSearchOpen = useUI((s) => s.isSearchOpen)
  const searchQuery = useUI((s) => s.searchQuery)
  const setIsSearchOpen = useUI((s) => s.setIsSearchOpen)
  const setSearchQuery = useUI((s) => s.setSearchQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  const metadata = selectedAudio ? trackMeta[selectedAudio] : null
  const windowTitle = selectedAudio
    ? metadata?.title && metadata.title !== 'Unknown'
      ? metadata.title
      : basename(selectedAudio)
    : 'Magpie'

  const toggleInsidePane = sidebarOpen && !sidebarFloating

  return (
    <header
      className="app-drag relative flex h-10 shrink-0 items-center justify-center border-b bg-muted/35 transition-[padding] duration-200 ease-out motion-reduce:transition-none"
      style={{ paddingInline: toggleInsidePane ? TITLE_INSET_EXPANDED : TITLE_INSET_COLLAPSED }}
    >
      {/* Keep the toggle in viewport coordinates while the sidebar animates.
          Animating it relative to this moving header combines two transitions
          and can briefly send it left when the sidebar starts opening. */}
      <div
        className="app-no-drag fixed top-5 z-40 -translate-y-1/2 transition-[left] duration-200 ease-out motion-reduce:transition-none"
        style={{
          left: toggleInsidePane
            ? `calc(var(--sidebar-width) + ${EXPANDED_TOGGLE_GAP}px)`
            : COLLAPSED_TOGGLE_LEFT
        }}
      >
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Hide collections' : 'Show collections'}
          aria-pressed={sidebarOpen}
        >
          <PanelLeft className="size-3.5" />
        </Button>
      </div>
      <span
        className={cn(
          'max-w-[min(100%,24rem)] truncate text-[11px] font-medium tracking-wide text-muted-foreground/70',
          isSearchOpen && 'invisible'
        )}
      >
        {windowTitle}
      </span>
      <div className="app-no-drag absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {isSearchOpen ? (
          <div className="flex h-7 items-center rounded-md border bg-background/80 px-2 shadow-xs">
            <Search className="mr-1.5 size-3.5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search songs…"
              className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsSearchOpen(false)
              }}
            />
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Close search"
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
            aria-label="Search songs"
          >
            <Search className="size-3.5" />
          </Button>
        )}
      </div>
    </header>
  )
}

function PlayerCenter(): React.JSX.Element {
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const addItemsToSelectedCollection = useLibrary((s) => s.addItemsToSelectedCollection)
  const addCollectionWithItems = useLibrary((s) => s.addCollectionWithItems)
  const mainView = useUI((s) => s.mainView)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (event: React.DragEvent): void => {
    event.preventDefault()
    dragCounter.current += 1
    setIsDragOver(true)
  }

  const handleDragLeave = (): void => {
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }

  const handleDrop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)

    const paths: string[] = []
    const folderPaths: string[] = []
    for (const file of Array.from(event.dataTransfer.files)) {
      const path = window.soundbox.getPathForFile(file)
      if (!path) continue
      const info = await window.soundbox.getPathInfo(path)
      if (!info) continue

      if (!selectedCollectionId) {
        if (!info.isDirectory) continue

        const tree = await window.soundbox.readTree(path)
        const folderItems: string[] = []
        const flatten = (node: import('../../../preload/soundbox').TreeNode): void => {
          if (node.kind === 'audio') folderItems.push(node.path)
          else node.children.forEach(flatten)
        }
        flatten(tree)

        if (folderItems.length > 0) {
          addCollectionWithItems(basename(path), folderItems, [path])
        }
        continue
      }

      if (info.isFile) {
        if (['.mp3', '.m4a', '.m4b', '.flac', '.ogg', '.wav'].includes(info.ext)) paths.push(path)
      } else if (info.isDirectory) {
        folderPaths.push(path)
        const tree = await window.soundbox.readTree(path)
        const flatten = (node: import('../../../preload/soundbox').TreeNode): void => {
          if (node.kind === 'audio') paths.push(node.path)
          else node.children.forEach(flatten)
        }
        flatten(tree)
      }
    }
    if (paths.length > 0) addItemsToSelectedCollection(paths)
    if (folderPaths.length > 0) {
      useLibrary.getState().addFoldersToSelectedCollection(folderPaths)
    }
  }

  // Lyrics accept no drops — only the playlist wires up the handlers below.
  const dropHandlers =
    mainView === 'list'
      ? {
          onDragEnter: handleDragEnter,
          onDragLeave: handleDragLeave,
          onDragOver: (event: React.DragEvent) => event.preventDefault(),
          onDrop: handleDrop
        }
      : {}

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col" {...dropHandlers}>
      <AudioPlayer />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {mainView === 'lyrics' ? (
          <LyricsView />
        ) : (
          <ScrollArea className="min-h-0 flex-1 bg-background">
            <AudioList />
          </ScrollArea>
        )}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-1.5 z-40 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/50 bg-background/90 px-4 text-center backdrop-blur-sm">
            <FolderPlus className="h-8 w-8 text-primary/70" strokeWidth={1.75} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {selectedCollectionId ? 'Drop audio here' : 'Drop folder here'}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedCollectionId
                  ? 'Adds audio to the current collection'
                  : 'Creates a collection from the folder'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
