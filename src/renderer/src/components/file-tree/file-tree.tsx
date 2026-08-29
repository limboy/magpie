import { useState, useRef, useEffect, useCallback } from 'react'
import { Folder, FolderPlus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createCollectionFromFolder } from '@/lib/collections'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'

const COLLECTION_DRAG_TYPE = 'application/x-magpie-collection'

type DropTarget = {
  id: string
  position: 'before' | 'after'
}

export function FileTree({
  onSelectCollection
}: {
  onSelectCollection?: () => void
}): React.JSX.Element {
  const {
    collections,
    selectedCollectionId,
    selectCollection,
    addCollection,
    reorderCollection,
    updateCollectionTitle,
    deleteCollection
  } = useLibrary()
  const setPlaying = usePlayer((s) => s.setPlaying)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const draggedCollectionIdRef = useRef<string | null>(null)
  const dropTargetRef = useRef<DropTarget | null>(null)
  const dragCounter = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateDropTarget = useCallback((target: DropTarget | null): void => {
    dropTargetRef.current = target
    setDropTarget((current) =>
      current?.id === target?.id && current?.position === target?.position ? current : target
    )
  }, [])

  const clearCollectionDrag = useCallback((): void => {
    draggedCollectionIdRef.current = null
    dropTargetRef.current = null
    setDraggedCollectionId(null)
    setDropTarget(null)
  }, [])

  const completeCollectionDrop = useCallback(
    (event: React.DragEvent): boolean => {
      if (!event.dataTransfer.types.includes(COLLECTION_DRAG_TYPE)) return false
      event.preventDefault()
      event.stopPropagation()

      const sourceId =
        event.dataTransfer.getData(COLLECTION_DRAG_TYPE) || draggedCollectionIdRef.current
      const target = dropTargetRef.current
      if (sourceId && target) {
        reorderCollection(sourceId, target.id, target.position)
      }
      clearCollectionDrag()
      return true
    },
    [clearCollectionDrag, reorderCollection]
  )

  const handleAddDefault = useCallback((): void => {
    const baseName = 'New Collection'
    let title = baseName
    let counter = 1

    while (collections.some((c) => c.title === title)) {
      title = `${baseName} ${++counter}`
    }

    const id = addCollection(title)
    setEditingId(id)
    setEditingTitle(title)
    setPlaying(false)
  }, [collections, addCollection, setPlaying])

  const handleRename = useCallback(
    (id: string, title: string): void => {
      const trimmed = title.trim()
      if (trimmed) {
        updateCollectionTitle(id, trimmed)
      }
      setEditingId(null)
    },
    [updateCollectionTitle]
  )

  const handleDelete = useCallback(
    (id: string, title: string): void => {
      if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
        deleteCollection(id)
      }
    },
    [deleteCollection]
  )

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    const unrename = window.soundbox.onRenameCollection((id, title) => {
      setEditingId(id)
      setEditingTitle(title)
    })
    const undelete = window.soundbox.onDeleteCollection((id, title) => {
      handleDelete(id, title)
    })
    const unnew = window.soundbox.onNewCollection(() => {
      handleAddDefault()
    })
    return () => {
      unrename()
      undelete()
      unnew()
    }
  }, [handleDelete, handleAddDefault])

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    void window.soundbox.showSidebarContextMenu()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounter.current++
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent): void => {
      if (e.dataTransfer.types.includes(COLLECTION_DRAG_TYPE)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        const rows = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>('[data-collection-id]')
        )
        if (rows.length === 0) return

        let target: DropTarget = {
          id: rows[0].dataset.collectionId as string,
          position: 'before'
        }
        for (const row of rows) {
          if (e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2) break
          target = { id: row.dataset.collectionId as string, position: 'after' }
        }

        updateDropTarget(target.id === draggedCollectionIdRef.current ? null : target)
        return
      }
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
    },
    [updateDropTarget]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      if (completeCollectionDrop(e)) return
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)

      for (const file of files) {
        const path = window.soundbox.getPathForFile(file)
        if (!path) continue
        const info = await window.soundbox.getPathInfo(path)
        if (!info?.isDirectory) continue // only folders create collections

        // Creates the collection (named after the folder) and selects it.
        await createCollectionFromFolder(path)
      }
    },
    [completeCollectionDrop]
  )

  const handleCollectionDragStart = useCallback(
    (event: React.DragEvent, id: string): void => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(COLLECTION_DRAG_TYPE, id)
      draggedCollectionIdRef.current = id
      setDraggedCollectionId(id)
      updateDropTarget(null)
    },
    [updateDropTarget]
  )

  const handleCollectionDragOver = useCallback(
    (event: React.DragEvent, id: string): void => {
      if (!event.dataTransfer.types.includes(COLLECTION_DRAG_TYPE)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'

      if (id === draggedCollectionIdRef.current) {
        updateDropTarget(null)
        return
      }

      const bounds = event.currentTarget.getBoundingClientRect()
      const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
      updateDropTarget({ id, position })
    },
    [updateDropTarget]
  )

  const handleCollectionDrop = useCallback(
    (event: React.DragEvent): void => {
      completeCollectionDrop(event)
    },
    [completeCollectionDrop]
  )

  const handleCollectionDragEnd = clearCollectionDrag

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background"
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-1.5 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/50 bg-background/90 px-4 text-center backdrop-blur-sm">
          <FolderPlus className="h-8 w-8 text-primary/70" strokeWidth={1.75} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Drop folder here</p>
            <p className="text-xs text-muted-foreground">Creates a collection from the folder</p>
          </div>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1 p-2">
        {collections.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            Drag a folder here — or use{' '}
            <FolderPlus className="inline size-3.5 -translate-y-px" aria-hidden /> above — to create
            a collection.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {collections.map((c) => (
              <div
                key={c.id}
                className="relative"
                data-collection-id={c.id}
                onDragOver={(event) => handleCollectionDragOver(event, c.id)}
                onDrop={handleCollectionDrop}
              >
                {dropTarget?.id === c.id && (
                  <div
                    className={`pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-primary ${dropTarget.position === 'before' ? '-top-px' : '-bottom-px'}`}
                  />
                )}
                {editingId === c.id ? (
                  <div className="flex items-center gap-2 rounded-md px-2 py-1 bg-accent">
                    <Folder className="h-4 w-4 shrink-0 opacity-70" />
                    <input
                      ref={inputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRename(c.id, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(c.id, editingTitle)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-full h-6 bg-transparent text-sm outline-none"
                    />
                  </div>
                ) : (
                  <button
                    draggable
                    onDragStart={(event) => handleCollectionDragStart(event, c.id)}
                    onDragEnd={handleCollectionDragEnd}
                    onClick={() => {
                      selectCollection(c.id)
                      onSelectCollection?.()
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void window.soundbox.showCollectionContextMenu(c.id, c.title)
                    }}
                    className={`flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-[color,background-color,opacity] ${draggedCollectionId === c.id ? 'opacity-40' : ''} ${selectedCollectionId === c.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <Folder className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                      {c.items.length}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
