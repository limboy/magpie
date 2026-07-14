import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileAudio, Star } from 'lucide-react'
import { basename } from '@/lib/audio-extensions'
import { msToClock } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'

type AudioItem = {
  path: string
  index: number
  title: string
  artist: string
  duration: number | null
  liked: boolean
}

type ListSelection = {
  collectionId: string | null
  paths: Set<string>
  anchorPath: string | null
}

export function AudioList(): React.JSX.Element {
  const collections = useLibrary((state) => state.collections)
  const selectedCollectionId = useLibrary((state) => state.selectedCollectionId)
  const selectedAudio = useLibrary((state) => state.selectedAudio)
  const selectAudio = useLibrary((state) => state.selectAudio)
  const removeItemsFromSelectedCollection = useLibrary(
    (state) => state.removeItemsFromSelectedCollection
  )
  const toggleLike = useLibrary((state) => state.toggleLike)
  const likedPaths = useLibrary((state) => state.likedPaths)
  const trackMeta = useLibrary((state) => state.trackMeta)
  const trackDurations = useLibrary((state) => state.trackDurations)
  const setTrackMeta = useLibrary((state) => state.setTrackMeta)
  const setTrackDuration = useLibrary((state) => state.setTrackDuration)
  const setBulkTrackInfo = useLibrary((state) => state.setBulkTrackInfo)
  const setOrderedPaths = useLibrary((state) => state.setOrderedPaths)
  const setPlaying = usePlayer((state) => state.setPlaying)
  const searchQuery = useUI((state) => state.searchQuery)
  const showStarredOnly = useUI((state) => state.showStarredOnly)
  const [selection, setSelection] = useState<ListSelection>(() => ({
    collectionId: null,
    paths: new Set(),
    anchorPath: null
  }))

  const activeCollection = collections.find((item) => item.id === selectedCollectionId)
  const paths = useMemo(() => activeCollection?.items ?? [], [activeCollection])

  useEffect(() => {
    let cancelled = false

    const loadMetadata = async (): Promise<void> => {
      if (paths.length === 0) return
      const bulk = await window.soundbox.getBulkMetadata(paths).catch(() => ({}))
      if (cancelled) return
      setBulkTrackInfo(bulk)

      const current = useLibrary.getState()
      const missing = paths.filter(
        (path) => !(path in current.trackMeta) || !(path in current.trackDurations)
      )

      for (const path of missing) {
        if (cancelled) return
        const info = await window.soundbox.getPathInfo(path).catch(() => null)
        if (!info) continue

        if (!(path in useLibrary.getState().trackDurations)) {
          const duration = await window.soundbox.probeDuration(path).catch(() => null)
          if (cancelled) return
          setTrackDuration(path, duration)
        }
        if (!(path in useLibrary.getState().trackMeta)) {
          const metadata = await window.soundbox.probeMetadata(path).catch(() => null)
          if (cancelled) return
          setTrackMeta(
            path,
            metadata ?? { artist: 'Unknown', album: 'Unknown', title: basename(path) }
          )
        }
      }
    }

    void loadMetadata()
    const handleFocus = (): void => void loadMetadata()
    window.addEventListener('focus', handleFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
    }
  }, [paths, setBulkTrackInfo, setTrackDuration, setTrackMeta])

  useEffect(() => {
    return window.soundbox.onPlaySong((path) => {
      selectAudio(path)
      void window.soundbox.setState({ lastAudioPath: path })
      setPlaying(true)
    })
  }, [selectAudio, setPlaying])

  const items = useMemo<AudioItem[]>(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    return paths
      .map((path, index) => {
        const metadata = trackMeta[path]
        return {
          path,
          index: index + 1,
          title: metadata?.title && metadata.title !== 'Unknown' ? metadata.title : basename(path),
          artist:
            metadata?.artist && metadata.artist !== 'Unknown' ? metadata.artist : 'Unknown Artist',
          duration: trackDurations[path] ?? null,
          liked: Boolean(likedPaths[path])
        }
      })
      .filter((item) => !showStarredOnly || item.liked)
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLocaleLowerCase().includes(normalizedQuery) ||
          item.artist.toLocaleLowerCase().includes(normalizedQuery)
      )
  }, [paths, trackMeta, trackDurations, likedPaths, searchQuery, showStarredOnly])

  const orderKey = items.map((item) => item.path).join('\u0000')
  useEffect(() => {
    setOrderedPaths(orderKey ? orderKey.split('\u0000') : [])
  }, [orderKey, setOrderedPaths])

  const selectedPaths = useMemo(() => {
    if (selection.collectionId !== selectedCollectionId) return new Set<string>()
    const visiblePaths = new Set(items.map((item) => item.path))
    return new Set(Array.from(selection.paths).filter((path) => visiblePaths.has(path)))
  }, [items, selectedCollectionId, selection])

  const removePaths = useCallback(
    (pathsToRemove: string[]): void => {
      if (pathsToRemove.length === 0) return
      removeItemsFromSelectedCollection(pathsToRemove)
      setSelection({ collectionId: selectedCollectionId, paths: new Set(), anchorPath: null })
    },
    [removeItemsFromSelectedCollection, selectedCollectionId]
  )

  useEffect(() => window.soundbox.onRemoveSongs(removePaths), [removePaths])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement | null)?.isContentEditable
      ) {
        return
      }

      const pathsToRemove = Array.from(selectedPaths)
      if (pathsToRemove.length === 0) return
      event.preventDefault()
      removePaths(pathsToRemove)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removePaths, selectedPaths])

  if (!activeCollection) return <EmptyList message="Drag a folder here to start listening." />
  if (paths.length === 0) return <EmptyList message="Drag audio files or a folder here." />

  return (
    <div
      className="flex flex-col gap-0.5 py-2 pl-1 pr-2"
      role="listbox"
      aria-label="Playlist"
      aria-multiselectable="true"
    >
      {items.map((item) => {
        const active = item.path === selectedAudio
        const selected = selectedPaths.has(item.path)
        return (
          <div
            key={item.path}
            role="option"
            tabIndex={0}
            aria-selected={selected}
            className={cn(
              'group grid h-9 cursor-default grid-cols-[38px_minmax(0,1fr)_56px_34px] items-center rounded-md px-1 text-sm transition-colors',
              selected
                ? 'bg-accent text-foreground'
                : active
                  ? 'bg-muted/70 text-foreground'
                  : 'hover:bg-muted/65'
            )}
            onClick={(event) => {
              if (event.shiftKey) {
                const anchorPath =
                  selection.collectionId === selectedCollectionId &&
                  selection.anchorPath &&
                  items.some((candidate) => candidate.path === selection.anchorPath)
                    ? selection.anchorPath
                    : item.path
                const anchorIndex = items.findIndex((candidate) => candidate.path === anchorPath)
                const clickedIndex = items.findIndex((candidate) => candidate.path === item.path)
                if (anchorIndex !== -1 && clickedIndex !== -1) {
                  const start = Math.min(anchorIndex, clickedIndex)
                  const end = Math.max(anchorIndex, clickedIndex)
                  setSelection({
                    collectionId: selectedCollectionId,
                    paths: new Set(items.slice(start, end + 1).map((candidate) => candidate.path)),
                    anchorPath
                  })
                }
                return
              }

              setSelection({
                collectionId: selectedCollectionId,
                paths: new Set([item.path]),
                anchorPath: item.path
              })
              selectAudio(item.path)
              void window.soundbox.setState({ lastAudioPath: item.path })
              setPlaying(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectAudio(item.path)
                void window.soundbox.setState({ lastAudioPath: item.path })
                setPlaying(true)
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              const contextSelection = selectedPaths.has(item.path)
                ? Array.from(selectedPaths)
                : [item.path]
              if (!selectedPaths.has(item.path)) {
                setSelection({
                  collectionId: selectedCollectionId,
                  paths: new Set([item.path]),
                  anchorPath: item.path
                })
              }
              void window.soundbox.showSongContextMenu(item.path, contextSelection)
            }}
          >
            <span
              className={cn(
                'text-right text-xs tabular-nums text-muted-foreground/60',
                active && 'font-medium text-foreground'
              )}
            >
              {item.index}.
            </span>
            <div className="min-w-0 pl-2">
              <p className="truncate">
                <span className={cn('font-medium', active && 'font-semibold')}>{item.title}</span>
                <span className="text-muted-foreground"> — {item.artist}</span>
              </p>
            </div>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {msToClock(item.duration)}
            </span>
            <button
              type="button"
              className={cn(
                'ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:text-foreground',
                item.liked && 'text-foreground'
              )}
              onClick={(event) => {
                event.stopPropagation()
                toggleLike(item.path)
              }}
              aria-label={item.liked ? 'Unstar song' : 'Star song'}
              aria-pressed={item.liked}
              title={item.liked ? 'Unstar' : 'Star'}
            >
              <Star className={cn('size-3.5', item.liked && 'fill-current')} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function EmptyList({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
      <div>
        <FileAudio className="mx-auto size-8 opacity-25" />
        <p className="mt-2">{message}</p>
      </div>
    </div>
  )
}
