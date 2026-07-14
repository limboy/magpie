import { useEffect, useRef } from 'react'

const LEFT_MIN = 200
const LEFT_MAX = 300

export function TwoPane({
  left,
  center,
  leftOpen,
  leftWidth,
  onLeftWidthChange
}: {
  left: React.ReactNode
  center: React.ReactNode
  leftOpen: boolean
  leftWidth: number
  onLeftWidthChange: (w: number) => void
}): React.JSX.Element {
  return (
    <div className="flex-1 min-h-0 flex overflow-hidden bg-background text-foreground relative">
      <aside
        className="shrink-0 border-r bg-secondary/40 backdrop-blur-sm overflow-hidden relative z-20"
        style={{
          width: leftOpen ? leftWidth : 0
        }}
        aria-hidden={!leftOpen}
      >
        <div style={{ width: leftWidth }} className="h-full">
          {left}
        </div>
      </aside>
      {leftOpen && (
        <Resizer
          side="left"
          currentSize={leftWidth}
          min={LEFT_MIN}
          max={LEFT_MAX}
          onResize={onLeftWidthChange}
        />
      )}
      <main className="flex-1 min-w-0 flex flex-col">{center}</main>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function Resizer({
  side,
  currentSize,
  min,
  max,
  onResize,
  onDragStart,
  onDragEnd
}: {
  side: 'left' | 'right'
  currentSize: number
  min: number
  max: number
  onResize: (w: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}): React.JSX.Element {
  const startX = useRef<number | null>(null)
  const startSize = useRef(0)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  const stop = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (startX.current == null) return
    startX.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onDragEnd?.()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    startX.current = e.clientX
    startSize.current = currentSize
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    onDragStart?.()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    const delta = side === 'left' ? dx : -dx
    onResizeRef.current(clamp(startSize.current + delta, min, max))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      className="relative w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-border/80 active:bg-border transition-colors -mr-1 z-50"
    />
  )
}
