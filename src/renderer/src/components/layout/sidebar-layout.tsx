import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const SIDEBAR_WIDTH = 280
// The content pane stops fitting the transport controls on one row below
// this, so a window too narrow to seat both side by side gets a floating
// sidebar instead.
const MIN_CONTENT_WIDTH = 400

function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handleResize = (): void => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return viewportWidth
}

// The window splits left to right: the collections sidebar at a fixed width,
// and the content pane beside it. Collapsing keeps the sidebar mounted at
// zero width so it slides rather than pops. Once the window is too narrow for
// both, the sidebar floats above the content and a click outside (or Escape)
// dismisses it.
export function SidebarLayout({
  sidebar,
  content,
  open,
  onRequestClose,
  onFloatingChange
}: {
  sidebar: React.ReactNode
  content: React.ReactNode
  open: boolean
  onRequestClose: () => void
  onFloatingChange: (floating: boolean) => void
}): React.JSX.Element {
  const viewportWidth = useViewportWidth()
  const floating = viewportWidth - SIDEBAR_WIDTH < MIN_CONTENT_WIDTH

  useEffect(() => {
    onFloatingChange(floating)
  }, [floating, onFloatingChange])

  useEffect(() => {
    if (!floating || !open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [floating, open, onRequestClose])

  return (
    <div
      className="relative flex h-screen overflow-hidden bg-background text-foreground"
      style={{ '--sidebar-width': `${SIDEBAR_WIDTH}px` } as React.CSSProperties}
    >
      <aside
        className={cn(
          'flex min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar transition-[width,transform] duration-150 ease-out motion-reduce:transition-none',
          open && 'border-r',
          floating && 'absolute inset-y-0 left-0 z-50 shadow-xl'
        )}
        style={
          floating
            ? {
                width: open ? SIDEBAR_WIDTH : 0,
                transform: open ? 'translateX(0)' : 'translateX(-100%)'
              }
            : { width: open ? SIDEBAR_WIDTH : 0 }
        }
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div style={{ width: SIDEBAR_WIDTH }} className="flex h-full min-h-0 flex-col">
          {sidebar}
        </div>
      </aside>
      {floating && open && (
        <div
          className="absolute inset-0 z-40 bg-black/50 animate-in fade-in-0 duration-150 motion-reduce:animate-none"
          onPointerDown={onRequestClose}
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">{content}</div>
    </div>
  )
}
