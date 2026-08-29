import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_WIDTH = 240
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 300
const STORAGE_KEY = 'magpie-sidebar-width'

function clamp(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function readStoredWidth(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) && stored > 0 ? clamp(stored) : DEFAULT_WIDTH
}

// The window splits left to right: the collections sidebar, and the content
// pane beside it. Drag the divider (or focus it and use the arrow keys) to
// resize the sidebar; the width is remembered across sessions. Collapsing
// keeps the sidebar mounted at zero width so it slides rather than pops.
export function SidebarLayout({
  sidebar,
  content,
  open
}: {
  sidebar: React.ReactNode
  content: React.ReactNode
  open: boolean
}): React.JSX.Element {
  const [width, setWidth] = useState(readStoredWidth)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  return (
    <div
      className="flex h-screen overflow-hidden bg-background text-foreground"
      style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}
    >
      <aside
        className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: open ? width : 0 }}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div style={{ width }} className="flex h-full min-h-0 flex-col">
          {sidebar}
        </div>
      </aside>
      {open && <Divider width={width} onResize={setWidth} />}
      <div className="flex min-w-0 flex-1 flex-col">{content}</div>
    </div>
  )
}

function Divider({
  width,
  onResize
}: {
  width: number
  onResize: (width: number) => void
}): React.JSX.Element {
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) return
      event.preventDefault()
      dragStart.current = { x: event.clientX, width }
      event.currentTarget.setPointerCapture(event.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragStart.current) return
      onResize(clamp(dragStart.current.width + (event.clientX - dragStart.current.x)))
    },
    [onResize]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragStart.current) return
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const step = event.shiftKey ? 32 : 8
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onResize(clamp(width - step))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onResize(clamp(width + step))
      } else if (event.key === 'Home') {
        event.preventDefault()
        onResize(MIN_WIDTH)
      } else if (event.key === 'End') {
        event.preventDefault()
        onResize(MAX_WIDTH)
      }
    },
    [width, onResize]
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="relative z-30 w-px shrink-0 cursor-col-resize touch-none bg-border outline-none after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] hover:bg-foreground/25 focus-visible:bg-foreground/40"
    />
  )
}
