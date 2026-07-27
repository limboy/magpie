import { ChevronRight, FileAudio, Folder, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TreeNode } from '../../../../preload/soundbox'

type Props = {
  node: TreeNode
  depth: number
  selectedAudio: string | null
  selectedFolder: string | null
  defaultExpanded?: boolean
  onSelectFolder: (path: string) => void
  onSelectAudio: (path: string) => void
}

export function TreeNodeView({
  node,
  depth,
  selectedAudio,
  selectedFolder,
  defaultExpanded = false,
  onSelectFolder,
  onSelectAudio
}: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (node.kind === 'audio') {
    const active = selectedAudio === node.path
    return (
      <button
        type="button"
        onClick={() => onSelectAudio(node.path)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-sm transition-colors',
          active
            ? 'bg-primary/10 text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        <FileAudio className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  const activeFolder = selectedFolder === node.path
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          onSelectFolder(node.path)
          if (hasChildren) setExpanded((e) => !e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectFolder(node.path)
            if (hasChildren) setExpanded((s) => !s)
          } else if (e.key === 'ArrowRight') {
            setExpanded(true)
          } else if (e.key === 'ArrowLeft') {
            setExpanded(false)
          }
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm transition-colors',
          activeFolder ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60'
        )}
        style={{ paddingLeft: depth * 12 + 2 }}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            expanded && 'rotate-90',
            !hasChildren && 'opacity-0'
          )}
        />
        {expanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedAudio={selectedAudio}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              onSelectAudio={onSelectAudio}
            />
          ))}
        </div>
      )}
    </div>
  )
}
