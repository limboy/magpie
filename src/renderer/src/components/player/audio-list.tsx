import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, Clock3, FileAudio } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { basename } from '@/lib/audio-extensions'
import { audioMarkLabel, nextAudioMark } from '@/lib/audio-mark'
import { msToClock } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'
import { AudioMarkIcon } from './audio-mark-icon'
import type { AudioMark } from '../../../../preload/soundbox'

type AudioItem = {
  path: string
  index: number
  title: string
  artist: string
  album: string
  duration: number | null
  dateAdded: number | null
  mark: AudioMark | null
}

type SortKey = 'title' | 'dateAdded'
type SortDirection = 'asc' | 'desc'
type OptionalColumn = 'number' | 'duration' | 'dateAdded' | 'starred'
type ColumnVisibility = Record<OptionalColumn, boolean>

type ListPreferences = {
  sort: { key: SortKey; direction: SortDirection }
  columns: ColumnVisibility
}

const PREFERENCES_KEY = 'magpie-song-list-preferences'
const DEFAULT_PREFERENCES: ListPreferences = {
  sort: { key: 'title', direction: 'asc' },
  columns: { number: true, duration: true, dateAdded: true, starred: true }
}
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

function loadPreferences(): ListPreferences {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) ?? '{}'
    ) as Partial<ListPreferences>
    const key = parsed.sort?.key
    const direction = parsed.sort?.direction
    return {
      sort: {
        key: key === 'dateAdded' ? 'dateAdded' : 'title',
        direction: direction === 'desc' ? 'desc' : 'asc'
      },
      columns: {
        number: parsed.columns?.number ?? DEFAULT_PREFERENCES.columns.number,
        duration: parsed.columns?.duration ?? DEFAULT_PREFERENCES.columns.duration,
        dateAdded: parsed.columns?.dateAdded ?? DEFAULT_PREFERENCES.columns.dateAdded,
        starred: parsed.columns?.starred ?? DEFAULT_PREFERENCES.columns.starred
      }
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
    usage: 'sort'
  })
}

type ListSelection = {
  collectionId: string | null
  paths: Set<string>
  anchorPath: string | null
  followsPlayback: boolean
}

export function AudioList(): React.JSX.Element {
  const collections = useLibrary((state) => state.collections)
  const selectedCollectionId = useLibrary((state) => state.selectedCollectionId)
  const selectedAudio = useLibrary((state) => state.selectedAudio)
  const selectAudio = useLibrary((state) => state.selectAudio)
  const removeItemsFromSelectedCollection = useLibrary(
    (state) => state.removeItemsFromSelectedCollection
  )
  const cycleAudioMark = useLibrary((state) => state.cycleAudioMark)
  const audioMarks = useLibrary((state) => state.audioMarks)
  const trackMeta = useLibrary((state) => state.trackMeta)
  const trackDurations = useLibrary((state) => state.trackDurations)
  const trackDatesAdded = useLibrary((state) => state.trackDatesAdded)
  const setTrackMeta = useLibrary((state) => state.setTrackMeta)
  const setTrackDuration = useLibrary((state) => state.setTrackDuration)
  const setBulkTrackInfo = useLibrary((state) => state.setBulkTrackInfo)
  const setBulkDatesAdded = useLibrary((state) => state.setBulkDatesAdded)
  const setOrderedPaths = useLibrary((state) => state.setOrderedPaths)
  const setPlaying = usePlayer((state) => state.setPlaying)
  const searchQuery = useUI((state) => state.searchQuery)
  const markFilter = useUI((state) => state.markFilter)
  const cycleMarkFilter = useUI((state) => state.cycleMarkFilter)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [selection, setSelection] = useState<ListSelection>(() => ({
    collectionId: null,
    paths: new Set(),
    anchorPath: null,
    followsPlayback: true
  }))
  const activeItemRef = useRef<HTMLDivElement | null>(null)
  const suppressScrollRef = useRef(false)

  const activeCollection = collections.find((item) => item.id === selectedCollectionId)
  const paths = useMemo(() => activeCollection?.items ?? [], [activeCollection])

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  }, [preferences])

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
    const loadDatesAdded = async (): Promise<void> => {
      const current = useLibrary.getState()
      const missing = paths.filter((path) => !(path in current.trackDatesAdded))
      if (missing.length === 0) return
      const dates = await window.soundbox.getBulkDateAdded(missing).catch(() => ({}))
      if (!cancelled) setBulkDatesAdded(dates)
    }

    void loadDatesAdded()
    const handleFocus = (): void => void loadMetadata()
    const handleDateFocus = (): void => void loadDatesAdded()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('focus', handleDateFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('focus', handleDateFocus)
    }
  }, [paths, setBulkDatesAdded, setBulkTrackInfo, setTrackDuration, setTrackMeta])

  useEffect(() => {
    return window.soundbox.onPlaySong((path) => {
      selectAudio(path)
      setSelection({
        collectionId: useLibrary.getState().selectedCollectionId,
        paths: new Set([path]),
        anchorPath: path,
        followsPlayback: true
      })
      void window.soundbox.setState({ lastAudioPath: path })
      setPlaying(true)
    })
  }, [selectAudio, setPlaying])

  const items = useMemo<AudioItem[]>(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    const filtered = paths
      .map((path, index) => {
        const metadata = trackMeta[path]
        return {
          path,
          index,
          title: metadata?.title && metadata.title !== 'Unknown' ? metadata.title : basename(path),
          artist:
            metadata?.artist && metadata.artist !== 'Unknown' ? metadata.artist : 'Unknown Artist',
          album: metadata?.album && metadata.album !== 'Unknown' ? metadata.album : '',
          duration: trackDurations[path] ?? null,
          dateAdded: trackDatesAdded[path] ?? null,
          mark: audioMarks[path] ?? null
        }
      })
      .filter((item) => markFilter === null || item.mark === markFilter)
      .filter(
        (item) =>
          !normalizedQuery ||
          item.title.toLocaleLowerCase().includes(normalizedQuery) ||
          item.artist.toLocaleLowerCase().includes(normalizedQuery)
      )

    filtered.sort((a, b) => {
      let comparison = 0
      if (preferences.sort.key === 'title') {
        comparison = compareTitles(a.title, b.title)
      } else if (a.dateAdded === null || b.dateAdded === null) {
        if (a.dateAdded === null && b.dateAdded !== null) return 1
        if (a.dateAdded !== null && b.dateAdded === null) return -1
      } else {
        comparison = a.dateAdded - b.dateAdded
      }

      if (comparison === 0) comparison = a.index - b.index
      return preferences.sort.direction === 'asc' ? comparison : -comparison
    })

    return filtered.map((item, index) => ({ ...item, index: index + 1 }))
  }, [
    paths,
    trackMeta,
    trackDurations,
    trackDatesAdded,
    audioMarks,
    searchQuery,
    markFilter,
    preferences.sort
  ])

  const gridTemplateColumns = useMemo(
    () =>
      [
        preferences.columns.number && '38px',
        'minmax(0, 1fr)',
        preferences.columns.duration && '56px',
        preferences.columns.dateAdded && '126px',
        preferences.columns.starred && '34px'
      ]
        .filter(Boolean)
        .join(' '),
    [preferences.columns]
  )

  const toggleSort = (key: SortKey): void => {
    setPreferences((current) => ({
      ...current,
      sort: {
        key,
        direction: current.sort.key === key && current.sort.direction === 'asc' ? 'desc' : 'asc'
      }
    }))
  }

  const setColumnVisible = (column: OptionalColumn, visible: boolean): void => {
    if (column === 'starred' && !visible && markFilter !== null) {
      useUI.setState({ markFilter: null })
    }
    setPreferences((current) => ({
      ...current,
      columns: { ...current.columns, [column]: visible }
    }))
  }

  const orderKey = items.map((item) => item.path).join('\u0000')
  useEffect(() => {
    setOrderedPaths(orderKey ? orderKey.split('\u0000') : [])
  }, [orderKey, setOrderedPaths])

  useEffect(() => {
    if (!selectedAudio) return
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false
      return
    }
    const frame = requestAnimationFrame(() => {
      activeItemRef.current?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedAudio, orderKey])

  const selectedPaths = useMemo(() => {
    const visiblePaths = new Set(items.map((item) => item.path))
    if (selection.followsPlayback) {
      return selectedAudio && visiblePaths.has(selectedAudio)
        ? new Set([selectedAudio])
        : new Set<string>()
    }
    if (selection.collectionId !== selectedCollectionId) return new Set<string>()
    return new Set(Array.from(selection.paths).filter((path) => visiblePaths.has(path)))
  }, [items, selectedAudio, selectedCollectionId, selection])

  const removePaths = useCallback(
    (pathsToRemove: string[]): void => {
      if (pathsToRemove.length === 0) return
      removeItemsFromSelectedCollection(pathsToRemove)
      setSelection({
        collectionId: selectedCollectionId,
        paths: new Set(),
        anchorPath: null,
        followsPlayback: true
      })
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
      className="flex flex-col mb-2 gap-0.5"
      role="listbox"
      aria-label="Playlist"
      aria-multiselectable="true"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="sticky top-0 z-10 mb-2 grid h-9 shrink-0 items-center border-b bg-background px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70"
            style={{ gridTemplateColumns }}
          >
            {preferences.columns.number && (
              <span aria-hidden="true" className="text-right text-xs">
                #
              </span>
            )}
            <button
              type="button"
              className="flex h-full min-w-0 items-center gap-1 pl-3 text-left transition-colors hover:text-foreground"
              onClick={() => toggleSort('title')}
              aria-label={`Sort by title ${preferences.sort.key === 'title' && preferences.sort.direction === 'asc' ? 'descending' : 'ascending'}`}
            >
              <span className="truncate">Title</span>
              <SortIndicator column="title" sort={preferences.sort} />
            </button>
            {preferences.columns.duration && (
              <span className="flex items-center justify-end pr-1" aria-label="Duration">
                <Clock3 className="size-3.5" aria-hidden="true" />
              </span>
            )}
            {preferences.columns.dateAdded && (
              <button
                type="button"
                className="flex h-full items-center justify-end gap-1 pr-1 text-right transition-colors hover:text-foreground"
                onClick={() => toggleSort('dateAdded')}
                aria-label={`Sort by date added ${preferences.sort.key === 'dateAdded' && preferences.sort.direction === 'asc' ? 'descending' : 'ascending'}`}
              >
                <CalendarPlus className="size-3.5" />
                <span>Date Added</span>
                <SortIndicator column="dateAdded" sort={preferences.sort} />
              </button>
            )}
            {preferences.columns.starred && (
              <button
                type="button"
                className={cn(
                  'ml-[2px] flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:text-foreground',
                  markFilter !== null && 'text-foreground'
                )}
                onClick={cycleMarkFilter}
                aria-label={
                  markFilter === null
                    ? 'Showing all songs; click to show Star songs'
                    : `Showing ${audioMarkLabel(markFilter)} songs; click for ${nextAudioMark(markFilter) === null ? 'all songs' : `${audioMarkLabel(nextAudioMark(markFilter))} songs`}`
                }
                aria-pressed={markFilter !== null}
              >
                <AudioMarkIcon mark={markFilter} className="size-3.5" />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuLabel>Show Columns</ContextMenuLabel>
          <ContextMenuCheckboxItem checked disabled>
            Title
          </ContextMenuCheckboxItem>
          <ColumnMenuItem
            label="Number"
            checked={preferences.columns.number}
            onCheckedChange={(checked) => setColumnVisible('number', checked)}
          />
          <ColumnMenuItem
            label="Duration"
            checked={preferences.columns.duration}
            onCheckedChange={(checked) => setColumnVisible('duration', checked)}
          />
          <ColumnMenuItem
            label="Date Added"
            checked={preferences.columns.dateAdded}
            onCheckedChange={(checked) => setColumnVisible('dateAdded', checked)}
          />
          <ColumnMenuItem
            label="Marks"
            checked={preferences.columns.starred}
            onCheckedChange={(checked) => setColumnVisible('starred', checked)}
          />
        </ContextMenuContent>
      </ContextMenu>
      {items.map((item) => {
        const active = item.path === selectedAudio
        const selected = selectedPaths.has(item.path)
        return (
          <div
            key={item.path}
            ref={active ? activeItemRef : undefined}
            role="option"
            tabIndex={0}
            aria-selected={selected}
            className={cn(
              'group mx-2 grid h-9 cursor-default items-center rounded-md text-sm transition-colors',
              selected
                ? 'bg-muted text-foreground'
                : active
                  ? 'bg-muted/70 text-foreground'
                  : 'hover:bg-muted/70'
            )}
            style={{ gridTemplateColumns }}
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
                    anchorPath,
                    followsPlayback: false
                  })
                }
                return
              }

              setSelection({
                collectionId: selectedCollectionId,
                paths: new Set([item.path]),
                anchorPath: item.path,
                followsPlayback: true
              })
              suppressScrollRef.current = true
              selectAudio(item.path)
              void window.soundbox.setState({ lastAudioPath: item.path })
              setPlaying(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                setSelection({
                  collectionId: selectedCollectionId,
                  paths: new Set([item.path]),
                  anchorPath: item.path,
                  followsPlayback: true
                })
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
                  anchorPath: item.path,
                  followsPlayback: false
                })
              }
              void window.soundbox.showSongContextMenu(item.path, contextSelection)
            }}
          >
            {preferences.columns.number && (
              <span
                className={cn(
                  'text-right text-xs tabular-nums text-muted-foreground/60',
                  active && 'font-medium text-foreground'
                )}
              >
                {item.index}.
              </span>
            )}
            <div className={cn('min-w-0', preferences.columns.number ? 'pl-2' : 'pl-3')}>
              <p className="truncate">
                <span className={cn('font-medium', active && 'font-semibold')}>{item.title}</span>
                <span className="text-muted-foreground"> — {item.artist}</span>
                {item.album && <span className="text-muted-foreground/60"> · {item.album}</span>}
              </p>
            </div>
            {preferences.columns.duration && (
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {msToClock(item.duration)}
              </span>
            )}
            {preferences.columns.dateAdded && (
              <span
                className="truncate pr-1 text-right text-xs tabular-nums text-muted-foreground"
                title={
                  item.dateAdded === null
                    ? 'Date added unavailable'
                    : DATE_FORMATTER.format(item.dateAdded)
                }
              >
                {item.dateAdded === null ? '—' : DATE_FORMATTER.format(item.dateAdded)}
              </span>
            )}
            {preferences.columns.starred && (
              <button
                type="button"
                className={cn(
                  'ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:text-foreground',
                  item.mark && 'text-foreground'
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  cycleAudioMark(item.path)
                }}
                aria-label={`${audioMarkLabel(item.mark)} song; click for ${audioMarkLabel(nextAudioMark(item.mark))}`}
              >
                <AudioMarkIcon mark={item.mark} className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SortIndicator({
  column,
  sort
}: {
  column: SortKey
  sort: ListPreferences['sort']
}): React.JSX.Element {
  if (sort.key !== column) return <ArrowUpDown className="size-3 opacity-35" aria-hidden="true" />
  return sort.direction === 'asc' ? (
    <ArrowUp className="size-3 text-foreground" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3 text-foreground" aria-hidden="true" />
  )
}

function ColumnMenuItem({
  label,
  checked,
  onCheckedChange
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <ContextMenuCheckboxItem
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
    >
      {label}
    </ContextMenuCheckboxItem>
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
