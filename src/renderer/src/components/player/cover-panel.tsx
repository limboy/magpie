import { useCallback, useRef, useState } from 'react'
import { GripHorizontal, Music } from 'lucide-react'
import { useCoverArt } from '@/hooks/use-cover-art'

const MIN_HEIGHT = 200
const MAX_HEIGHT = 400
const DEFAULT_HEIGHT = 260

type Props = {
  selectedAudio: string | null
}

// Cover art shown above the transport controller. Drag the handle at the
// bottom edge (or use arrow keys while it's focused) to resize it.
export function CoverPanel({ selectedAudio }: Props): React.JSX.Element {
  const cover = useCoverArt(selectedAudio)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const dragStart = useRef<{ y: number; height: number } | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      dragStart.current = { y: event.clientY, height }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [height]
  )

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragStart.current) return
    const delta = event.clientY - dragStart.current.y
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStart.current.height + delta)))
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    dragStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 32 : 8
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHeight((h) => Math.max(MIN_HEIGHT, h - step))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHeight((h) => Math.min(MAX_HEIGHT, h + step))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHeight(MIN_HEIGHT)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHeight(MAX_HEIGHT)
    }
  }, [])

  return (
    <div className="relative shrink-0 border-b bg-muted/10" style={{ height }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden p-3">
        {cover ? (
          <img
            key={cover}
            src={cover}
            alt=""
            className="max-h-full max-w-full rounded-xl object-contain shadow-lg ring-1 ring-black/5 animate-in fade-in duration-500"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-xl bg-muted text-muted-foreground/30">
            <Music className="h-8 w-8" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Drag (or arrow-key) to resize the cover */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize cover art"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        tabIndex={0}
        className="group absolute inset-x-0 bottom-0 z-10 flex h-3 -translate-y-1/2 cursor-row-resize touch-none items-center justify-center outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-3.5 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground/70 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <GripHorizontal className="size-2.5" />
        </div>
      </div>
    </div>
  )
}
