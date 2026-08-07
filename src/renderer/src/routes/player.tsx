import { useEffect, useRef, useState } from 'react'
import { Folder, FolderPlus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from '@/components/file-tree/file-tree'
import { AudioList } from '@/components/player/audio-list'
import { AudioPlayer } from '@/components/player/audio-player'
import { LyricsView } from '@/components/player/lyrics-view'
import { UpdateIndicator } from '@/components/update-indicator'
import { basename } from '@/lib/audio-extensions'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'

export function PlayerRoute(): React.JSX.Element {
  const setCollections = useLibrary((s) => s.setCollections)
  const setLastAudioByCollection = useLibrary((s) => s.setLastAudioByCollection)
  const setLastAudioPositions = useLibrary((s) => s.setLastAudioPositions)
  const selectCollection = useLibrary((s) => s.selectCollection)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const setLikedPaths = useLibrary((s) => s.setLikedPaths)
  const setBulkTrackInfo = useLibrary((s) => s.setBulkTrackInfo)
  const setHydrated = useLibrary((s) => s.setHydrated)
  const hydrated = useLibrary((s) => s.hydrated)
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const trackMeta = useLibrary((s) => s.trackMeta)

  const isSearchOpen = useUI((s) => s.isSearchOpen)
  const searchQuery = useUI((s) => s.searchQuery)
  const setIsSearchOpen = useUI((s) => s.setIsSearchOpen)
  const setSearchQuery = useUI((s) => s.setSearchQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const metadata = selectedAudio ? trackMeta[selectedAudio] : null
  const windowTitle = selectedAudio
    ? metadata?.title && metadata.title !== 'Unknown'
      ? metadata.title
      : basename(selectedAudio)
    : 'Magpie'

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
      if (state.selectedCollectionId) selectCollection(state.selectedCollectionId)
      if (state.lastAudioPath) selectAudio(state.lastAudioPath)
      if (state.likedPaths) setLikedPaths(state.likedPaths)
      setHydrated(true)
    })()
  }, [
    setCollections,
    setLastAudioByCollection,
    setLastAudioPositions,
    selectCollection,
    selectAudio,
    setLikedPaths,
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

  useEffect(() => {
    return window.soundbox.onStateUpdated((state) => {
      const previous = useLibrary.getState()
      setCollections(state.collections)
      if (state.lastAudioByCollection) setLastAudioByCollection(state.lastAudioByCollection)
      if (state.selectedCollectionId !== previous.selectedCollectionId) {
        useLibrary.setState({ selectedCollectionId: state.selectedCollectionId })
      }
      if (state.lastAudioPath !== previous.selectedAudio) selectAudio(state.lastAudioPath)
      if (state.likedPaths) setLikedPaths(state.likedPaths)
    })
  }, [setCollections, setLastAudioByCollection, selectAudio, setLikedPaths])

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex flex-1 min-w-0 flex-col">
        <header className="app-drag relative flex h-10 shrink-0 items-center justify-center border-b bg-muted/35">
          <span
            className={cn(
              'max-w-[50%] truncate text-[11px] font-medium tracking-wide text-muted-foreground/70',
              isSearchOpen && 'invisible'
            )}
          >
            {windowTitle}
          </span>
          <div className="app-no-drag absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
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
                title="Search"
              >
                <Search className="size-3.5" />
              </Button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <PlayerCenter />
        </div>
        <StatusBar />
      </div>
    </div>
  )
}

function StatusBar(): React.JSX.Element {
  const mainView = useUI((s) => s.mainView)
  const toggleFoldersView = useUI((s) => s.toggleFoldersView)

  return (
    <footer className="grid h-8 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t bg-muted/55 px-1.5 text-[11px] text-muted-foreground backdrop-blur-xl">
      <div />

      <div className="justify-self-center">
        <UpdateIndicator />
      </div>

      <div className="flex items-center gap-1 justify-self-end">
        <Button
          size="icon"
          variant="ghost"
          className={cn('size-6', mainView === 'folders' && 'bg-accent text-foreground')}
          onClick={toggleFoldersView}
          aria-label={mainView === 'folders' ? 'Show playlist' : 'Show folders'}
          aria-pressed={mainView === 'folders'}
          title="Folders"
        >
          <Folder className="size-3.5" />
        </Button>
      </div>
    </footer>
  )
}

function PlayerCenter(): React.JSX.Element {
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const addItemsToSelectedCollection = useLibrary((s) => s.addItemsToSelectedCollection)
  const addCollectionWithItems = useLibrary((s) => s.addCollectionWithItems)
  const mainView = useUI((s) => s.mainView)
  const setMainView = useUI((s) => s.setMainView)
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

  // The folders view brings its own drop target, and lyrics accepts none —
  // only the playlist wires up the drop handlers below.
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
        {mainView === 'folders' ? (
          <FileTree onSelectCollection={() => setMainView('list')} />
        ) : mainView === 'lyrics' ? (
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
