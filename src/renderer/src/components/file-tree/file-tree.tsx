import { useState, useRef, useEffect, useCallback } from 'react'
import { Folder, FolderPlus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createCollectionFromFolder } from '@/lib/collections'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'

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
    updateCollectionTitle,
    deleteCollection
  } = useLibrary()
  const setPlaying = usePlayer((s) => s.setPlaying)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
    e.preventDefault()
    dragCounter.current++
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((): void => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent): Promise<void> => {
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
  }, [])

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
            Drag a folder here to create a collection.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {collections.map((c) => (
              <div key={c.id}>
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
                    onClick={() => {
                      selectCollection(c.id)
                      onSelectCollection?.()
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void window.soundbox.showCollectionContextMenu(c.id, c.title)
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${selectedCollectionId === c.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
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
