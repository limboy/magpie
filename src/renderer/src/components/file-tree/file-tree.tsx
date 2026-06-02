import { useState, useRef, useEffect, useCallback } from 'react'
import { Folder } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'

export function FileTree(): React.JSX.Element {
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

  const handleRename = useCallback((id: string, title: string): void => {
    const trimmed = title.trim()
    if (trimmed) {
      updateCollectionTitle(id, trimmed)
    }
    setEditingId(null)
  }, [updateCollectionTitle])

  const handleDelete = useCallback((id: string, title: string): void => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteCollection(id)
    }
  }, [deleteCollection])

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" onContextMenu={handleContextMenu}>
      <ScrollArea className="flex-1 p-2">
        {collections.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Right-click to create a collection.
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
                    onClick={() => selectCollection(c.id)}
                    onDoubleClick={() => {
                      setEditingId(c.id)
                      setEditingTitle(c.title)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void window.soundbox.showCollectionContextMenu(c.id, c.title)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingId(c.id)
                        setEditingTitle(c.title)
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${selectedCollectionId === c.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <Folder className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{c.title}</span>
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

