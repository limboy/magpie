import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeft, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TwoPane } from '@/components/layout/two-pane'
import { FileTree } from '@/components/file-tree/file-tree'
import { AudioList } from '@/components/player/audio-list'
import { AudioPlayer } from '@/components/player/audio-player'
import { UpdateIndicator } from '@/components/update-indicator'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'

export function PlayerRoute(): React.JSX.Element {
  const setCollections = useLibrary((s) => s.setCollections)
  const selectCollection = useLibrary((s) => s.selectCollection)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const setLikedPaths = useLibrary((s) => s.setLikedPaths)

  const leftSidebarOpen = useUI((s) => s.leftSidebarOpen)
  const leftSidebarWidth = useUI((s) => s.leftSidebarWidth)
  const setLeftSidebarOpen = useUI((s) => s.setLeftSidebarOpen)
  const setLeftSidebarWidth = useUI((s) => s.setLeftSidebarWidth)
  const isSearchOpen = useUI((s) => s.isSearchOpen)
  const searchQuery = useUI((s) => s.searchQuery)
  const setIsSearchOpen = useUI((s) => s.setIsSearchOpen)
  const setSearchQuery = useUI((s) => s.setSearchQuery)
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
      if (state.collections) {
        setCollections(state.collections)
      }
      if (state.selectedCollectionId) {
        selectCollection(state.selectedCollectionId)
      }
      if (state.lastAudioPath) {
        queueMicrotask(() => selectAudio(state.lastAudioPath))
      }
      if (state.likedPaths) {
        setLikedPaths(state.likedPaths)
      }
    })()
  }, [setCollections, selectCollection, selectAudio, setLikedPaths])

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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Global Top Navigation Bar */}
      <header className="app-drag flex h-10 shrink-0 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-3">
        {/* Left: macOS traffic light spacer + left sidebar toggler */}
        <div className="flex items-center gap-1 shrink-0" style={{ paddingLeft: 64 }}>
          {!isCompact && (
            <Button
              size="icon"
              variant="ghost"
              className="app-no-drag size-7"
              aria-label={leftSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-pressed={leftSidebarOpen}
              onClick={toggleLeft}
            >
              <PanelLeft
                className={`size-4 opacity-75`}
              />
            </Button>
          )}
        </div>

        {/* Right: Update indicator + Search */}
        <div className="flex items-center gap-2 app-no-drag">
          <UpdateIndicator />
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

      {/* Main Content */}
      <TwoPane
        leftOpen={!isCompact && leftSidebarOpen}
        leftWidth={leftSidebarWidth}
        onLeftWidthChange={setLeftSidebarWidth}
        left={<FileTree />}
        center={<PlayerCenter />}
      />
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
      className="@container h-full w-full relative flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AudioPlayer fullPlayer={fullPlayer} />
      {!fullPlayer && (
        <ScrollArea className="flex-1 min-h-0">
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
