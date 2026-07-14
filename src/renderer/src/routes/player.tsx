import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { List, MessageSquareQuote, Search, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from '@/components/file-tree/file-tree'
import { AudioList } from '@/components/player/audio-list'
import { AudioPlayer } from '@/components/player/audio-player'
import { LyricsSidebar } from '@/components/player/lyrics-sidebar'
import { UpdateIndicator } from '@/components/update-indicator'
import { basename } from '@/lib/audio-extensions'
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
  const hydrated = useLibrary((s) => s.hydrated)
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const trackMeta = useLibrary((s) => s.trackMeta)

  const foldersPageOpen = useUI((s) => s.foldersPageOpen)
  const setFoldersPageOpen = useUI((s) => s.setFoldersPageOpen)
  const lyricsSidebarOpen = useUI((s) => s.lyricsSidebarOpen)
  const isSearchOpen = useUI((s) => s.isSearchOpen)
  const searchQuery = useUI((s) => s.searchQuery)
  const setIsSearchOpen = useUI((s) => s.setIsSearchOpen)
  const setSearchQuery = useUI((s) => s.setSearchQuery)
  const showStarredOnly = useUI((s) => s.showStarredOnly)
  const toggleStarredOnly = useUI((s) => s.toggleStarredOnly)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const metadata = selectedAudio ? trackMeta[selectedAudio] : null
  const windowTitle = selectedAudio
    ? metadata?.title && metadata.title !== 'Unknown'
      ? metadata.title
      : basename(selectedAudio)
    : 'SoundBox'

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
      if (state.selectedCollectionId) selectCollection(state.selectedCollectionId)
      if (state.lastAudioPath) selectAudio(state.lastAudioPath)
      if (state.likedPaths) setLikedPaths(state.likedPaths)
      setHydrated(true)
    })()
  }, [setCollections, selectCollection, selectAudio, setLikedPaths, setBulkTrackInfo, setHydrated])

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
      if (state.selectedCollectionId !== previous.selectedCollectionId) {
        useLibrary.setState({ selectedCollectionId: state.selectedCollectionId })
      }
      if (state.lastAudioPath !== previous.selectedAudio) selectAudio(state.lastAudioPath)
      if (state.likedPaths) setLikedPaths(state.likedPaths)
    })
  }, [setCollections, selectAudio, setLikedPaths])

  useLayoutEffect(() => {
    window.soundbox.setLyricsPanelWidth(!foldersPageOpen && lyricsSidebarOpen ? 288 : 0)
  }, [foldersPageOpen, lyricsSidebarOpen])

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="app-drag relative flex h-10 shrink-0 items-center justify-center border-b bg-muted/35">
        <span
          className={cn(
            'max-w-[50%] truncate text-[11px] font-medium tracking-wide text-muted-foreground/70',
            isSearchOpen && 'invisible'
          )}
        >
          {windowTitle}
        </span>
        {!foldersPageOpen && (
          <div className="app-no-drag absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            <UpdateIndicator />
            <Button
              size="icon"
              variant="ghost"
              className={cn('size-7', showStarredOnly && 'text-foreground')}
              onClick={toggleStarredOnly}
              aria-label="Show starred songs only"
              aria-pressed={showStarredOnly}
              title="Starred songs"
            >
              <Star className={cn('size-3.5', showStarredOnly && 'fill-current')} />
            </Button>
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
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={cn('flex min-h-0 flex-1', foldersPageOpen && 'hidden')}>
          <PlayerCenter />
          {lyricsSidebarOpen && <LyricsSidebar />}
        </div>
        {foldersPageOpen && (
          <div className="h-full min-h-0 flex-1">
            <FileTree onSelectCollection={() => setFoldersPageOpen(false)} />
          </div>
        )}
      </div>

      <StatusBar />
    </div>
  )
}

function StatusBar(): React.JSX.Element {
  const collections = useLibrary((s) => s.collections)
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const foldersPageOpen = useUI((s) => s.foldersPageOpen)
  const lyricsSidebarOpen = useUI((s) => s.lyricsSidebarOpen)
  const toggleFoldersPage = useUI((s) => s.toggleFoldersPage)
  const setFoldersPageOpen = useUI((s) => s.setFoldersPageOpen)
  const toggleLyricsSidebar = useUI((s) => s.toggleLyricsSidebar)
  const collection = collections.find((item) => item.id === selectedCollectionId)

  return (
    <footer className="flex h-8 shrink-0 items-center border-t bg-muted/55 px-1.5 text-[11px] text-muted-foreground backdrop-blur-xl">
      <Button
        size="icon"
        variant="ghost"
        className={cn('size-6', foldersPageOpen && 'bg-accent text-foreground')}
        onClick={toggleFoldersPage}
        aria-label={foldersPageOpen ? 'Show player' : 'Show folders'}
        aria-pressed={foldersPageOpen}
        title="Folders"
      >
        <List className="size-3.5" />
      </Button>

      <div className="min-w-0 flex-1 truncate text-center">
        {collection
          ? `${collection.title} · ${collection.items.length} songs`
          : 'No folder selected'}
      </div>

      <Button
        size="icon"
        variant="ghost"
        className={cn('size-6', lyricsSidebarOpen && 'bg-accent text-foreground')}
        onClick={() => {
          if (foldersPageOpen) {
            setFoldersPageOpen(false)
            if (!lyricsSidebarOpen) toggleLyricsSidebar()
          } else {
            toggleLyricsSidebar()
          }
        }}
        aria-label={lyricsSidebarOpen ? 'Hide lyrics' : 'Show lyrics'}
        aria-pressed={lyricsSidebarOpen}
        title="Lyrics"
      >
        <MessageSquareQuote className="size-3.5" />
      </Button>
    </footer>
  )
}

function PlayerCenter(): React.JSX.Element {
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const addItemsToSelectedCollection = useLibrary((s) => s.addItemsToSelectedCollection)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (event: React.DragEvent): void => {
    event.preventDefault()
    dragCounter.current += 1
    if (selectedCollectionId) setIsDragOver(true)
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
    if (!selectedCollectionId) return

    const paths: string[] = []
    const folderPaths: string[] = []
    for (const file of Array.from(event.dataTransfer.files)) {
      const path = window.soundbox.getPathForFile(file)
      if (!path) continue
      const info = await window.soundbox.getPathInfo(path)
      if (!info) continue
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

  return (
    <main
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <AudioPlayer />
      <ScrollArea className="min-h-0 flex-1 bg-background">
        <AudioList />
      </ScrollArea>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-40 bg-primary/5 ring-2 ring-inset ring-primary/20 transition-opacity',
          isDragOver ? 'opacity-100' : 'opacity-0'
        )}
      />
    </main>
  )
}
