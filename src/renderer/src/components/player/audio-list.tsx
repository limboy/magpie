import { FileAudio, Play, ChevronsUpDown, ArrowUp, ArrowDown, Heart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnDef,
  VisibilityState
} from '@tanstack/react-table'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { basename } from '@/lib/audio-extensions'
import { msToClock } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'

type AudioItem = {
  path: string
  title: string
  artist: string
  album: string
  duration: number | null
  index: number
  likedAt: number | null
}

// Columns are not resizable. Icon/number columns get fixed pixel widths; the
// text columns flex proportionally to fill the remaining width of the pane.
const FIXED_WIDTHS: Record<string, number> = { index: 64, Like: 56, duration: 92 }
const FLEX_WIDTHS: Record<string, string> = { title: '42%', artist: '29%', album: '29%' }

function columnWidth(id: string): string | number {
  return FIXED_WIDTHS[id] ?? FLEX_WIDTHS[id] ?? 'auto'
}

export function AudioList(): React.JSX.Element {
  const collections = useLibrary((s) => s.collections)
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const toggleLike = useLibrary((s) => s.toggleLike)
  const likedPaths = useLibrary((s) => s.likedPaths)
  const setPlaying = usePlayer((s) => s.setPlaying)

  const trackMeta = useLibrary((s) => s.trackMeta)
  const trackDurations = useLibrary((s) => s.trackDurations)
  const setTrackMeta = useLibrary((s) => s.setTrackMeta)
  const setTrackDuration = useLibrary((s) => s.setTrackDuration)
  const setBulkTrackInfo = useLibrary((s) => s.setBulkTrackInfo)
  const setOrderedPaths = useLibrary((s) => s.setOrderedPaths)


  const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const activeCollection = collections.find((c) => c.id === selectedCollectionId)
  const rows = useMemo(() => (activeCollection ? activeCollection.items : []), [activeCollection])

  useEffect(() => {
    let cancelled = false

    const checkAll = async (): Promise<void> => {
      const pathsToCheck = [...rows]
      if (pathsToCheck.length === 0) return

      // First, get everything we can from the bulk cache
      const bulk = await window.soundbox.getBulkMetadata(pathsToCheck).catch(() => ({}))
      if (cancelled) return

      setBulkTrackInfo(bulk)

      const currentMeta = useLibrary.getState().trackMeta
      const currentDurations = useLibrary.getState().trackDurations

      const missing = pathsToCheck.filter(
        (p) => !(p in currentMeta) || !(p in currentDurations)
      )
      if (missing.length === 0) return

      for (const p of missing) {
        if (cancelled) return

        const info = await window.soundbox.getPathInfo(p).catch(() => null)
        if (!info) continue

        if (!(p in currentDurations)) {
          const d = await window.soundbox.probeDuration(p).catch(() => null)
          if (cancelled) return
          setTrackDuration(p, d)
        }

        if (!(p in currentMeta)) {
          const m = await window.soundbox.probeMetadata(p).catch(() => null)
          if (cancelled) return
          setTrackMeta(p, m || { artist: 'Unknown', album: 'Unknown', title: basename(p) })
        }
      }
    }

    void checkAll()

    const handleFocus = (): void => {
      void checkAll()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
    }
  }, [rows, setBulkTrackInfo, setTrackDuration, setTrackMeta])

  useEffect(() => {
    return window.soundbox.onPlaySong((path) => {
      selectAudio(path)
      void window.soundbox.setState({ lastAudioPath: path })
      setPlaying(true)
    })
  }, [selectAudio, setPlaying])

  const searchQuery = useUI((s) => s.searchQuery)

  const data = useMemo<AudioItem[]>(() => {
    const all = rows.map((path, index) => {
      const m = trackMeta[path]
      const duration = trackDurations[path] ?? null
      return {
        path,
        index: index + 1,
        title: m?.title && m.title !== 'Unknown' ? m.title : basename(path),
        artist: m?.artist && m.artist !== 'Unknown' ? m.artist : '-',
        album: m?.album && m.album !== 'Unknown' ? m.album : '-',
        duration,
        likedAt: likedPaths[path] || null
      }
    })

    if (!searchQuery) return all

    const q = searchQuery.toLowerCase()
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.artist.toLowerCase().includes(q) ||
        item.album.toLowerCase().includes(q)
    )
  }, [rows, trackMeta, trackDurations, searchQuery, likedPaths])

  const columns = useMemo<ColumnDef<AudioItem>[]>(() => {
    const cols: ColumnDef<AudioItem>[] = [
      {
        id: 'index',
        accessorKey: 'index',
        header: () => <div className="pl-2">#</div>,
        cell: (info) => {
          const path = info.row.original.path
          const active = path === selectedAudio
          return active ? (
            <div className="flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-primary shrink-0 fill-primary" />
            </div>
          ) : (
            <div className="pl-2 text-muted-foreground/60 tabular-nums">
              {(info as any).displayIndex}
            </div>
          )
        },
        size: 50,
        minSize: 50,
        enableHiding: false
      },
      {
        id: 'Like',
        accessorKey: 'likedAt',
        header: ({ column }) => (
          <div className="flex items-center justify-center w-full">
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Like
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
              )}
            </button>
          </div>
        ),
        cell: (info) => {
          const likedAt = info.getValue() as number | null
          const path = info.row.original.path
          return (
            <div className="flex items-center justify-center">
              <button
                className={cn(
                  'p-1.5 rounded-full transition-all hover:bg-primary/10',
                  likedAt ? 'text-primary' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleLike(path)
                }}
              >
                <Heart className={cn('h-4 w-4', likedAt && 'fill-primary')} />
              </button>
            </div>
          )
        },
        size: 60,
        minSize: 60,
        enableHiding: true
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
            )}
          </button>
        ),
        cell: (info) => {
          const path = info.row.original.path
          const active = path === selectedAudio
          return (
            <span className={cn('truncate block', active && 'text-primary font-medium')}>
              {info.getValue() as string}
            </span>
          )
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) as string
          const b = rowB.getValue(columnId) as string
          return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base',
            usage: 'sort'
          })
        },
        size: 250,
        minSize: 100,
        enableHiding: false
      },
      {
        accessorKey: 'artist',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Artist
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
            )}
          </button>
        ),
        size: 150,
        minSize: 80
      },
      {
        accessorKey: 'album',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Album
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
            )}
          </button>
        ),
        size: 150,
        minSize: 80
      },
      {
        accessorKey: 'duration',
        header: ({ column }) => (
          <div className="text-right w-full pr-2">
            <button
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Duration
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
              )}
            </button>
          </div>
        ),
        cell: (info) => (
          <div className="text-right tabular-nums text-muted-foreground pr-2">
            {msToClock(info.getValue() as number | null)}
          </div>
        ),
        size: 90,
        minSize: 80
      }
    ]

    return cols
  }, [selectedAudio, toggleLike])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    enableColumnResizing: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  // Publish the visible (sorted + filtered) order so the player navigates the
  // same order the user sees. NUL can't appear in a path, so it is a safe
  // join separator for the dependency key.
  const orderKey = table
    .getRowModel()
    .rows.map((r) => r.original.path)
    .join('\u0000')
  useEffect(() => {
    setOrderedPaths(orderKey ? orderKey.split('\u0000') : [])
  }, [orderKey, setOrderedPaths])

  if (!activeCollection) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div>
          <FileAudio className="mx-auto h-8 w-8 opacity-30" />
          <p className="mt-2">Select or create a collection.</p>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div>
          <FileAudio className="mx-auto h-8 w-8 opacity-30" />
          <p className="mt-2">Drag audio files or folder here.</p>
        </div>
      </div>
    )
  }

  return (
    <Table className="min-w-full table-fixed border-collapse">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TableHeader className="sticky top-0 z-20 bg-muted/50 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="group whitespace-nowrap relative last:border-0 transition-colors"
                    style={{ width: columnWidth(header.column.id) }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Bottom Border */}
                    <div className="absolute inset-x-0 bottom-0 h-px bg-border z-30 pointer-events-none" />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => {
              return (
                <ContextMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </ContextMenuCheckboxItem>
              )
            })}
        </ContextMenuContent>
      </ContextMenu>
      <TableBody>
        {table.getRowModel().rows.map((row, i) => {
          const active = row.original.path === selectedAudio
          return (
            <TableRow
              key={row.id}
              onClick={() => {
                selectAudio(row.original.path)
                void window.soundbox.setState({ lastAudioPath: row.original.path })
                setPlaying(true)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                void window.soundbox.showSongContextMenu(row.original.path)
              }}
              className={cn('group', active && 'bg-accent/60')}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} style={{ width: columnWidth(cell.column.id) }}>
                  <div className="truncate">
                    {flexRender(cell.column.columnDef.cell, {
                      ...cell.getContext(),
                      displayIndex: i + 1
                    } as any)}
                  </div>
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
