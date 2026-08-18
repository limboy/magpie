import { useEffect, useRef } from 'react'
import { Loader2, Music2 } from 'lucide-react'
import { findActiveCueIndex, findActiveIndexByStart } from '@/lib/active-line'
import { cn } from '@/lib/utils'
import type { LyricsState } from '@/hooks/use-lyrics'

type Props = {
  state: LyricsState
  currentTimeMs: number
  onSeek: (ms: number) => void
}

export function LyricsPanel({ state, currentTimeMs, onSeek }: Props): React.JSX.Element {
  if (state.status === 'idle') {
    return <Centered>{null}</Centered>
  }

  if (state.status === 'loading') {
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
        <p className="mt-3 text-xs text-muted-foreground/60">Searching for lyrics…</p>
      </Centered>
    )
  }

  if (state.status === 'plain') {
    return (
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
        <p className="whitespace-pre-wrap text-left text-base leading-8 text-muted-foreground">
          {state.text}
        </p>
      </div>
    )
  }

  if (state.status === 'synced') {
    return <SyncedLyrics lines={state.lines} currentTimeMs={currentTimeMs} onSeek={onSeek} />
  }

  if (state.status === 'subtitles') {
    const activeIndex = findActiveCueIndex(state.cues, currentTimeMs)
    return (
      <TimedTextList
        lines={state.cues.map((cue) => ({ time: cue.start, text: cue.text }))}
        activeIndex={activeIndex}
        onSeek={onSeek}
      />
    )
  }

  return (
    <Centered>
      <Music2 className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.75} />
      <p className="mt-3 text-xs text-muted-foreground/50">No lyrics found</p>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
      {children}
    </div>
  )
}

function SyncedLyrics({
  lines,
  currentTimeMs,
  onSeek
}: {
  lines: { time: number; text: string }[]
  currentTimeMs: number
  onSeek: (ms: number) => void
}): React.JSX.Element {
  const activeIndex = findActiveIndexByStart(lines, currentTimeMs)
  return <TimedTextList lines={lines} activeIndex={activeIndex} onSeek={onSeek} />
}

function TimedTextList({
  lines,
  activeIndex,
  onSeek
}: {
  lines: { time: number; text: string }[]
  activeIndex: number
  onSeek: (ms: number) => void
}): React.JSX.Element {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col py-4">
        {lines.map((line, i) => {
          const active = i === activeIndex
          return (
            <button
              key={i}
              ref={active ? activeRef : undefined}
              onClick={() => onSeek(line.time)}
              className={cn(
                'block w-full origin-left whitespace-pre-wrap px-6 py-1.5 text-left text-base leading-5.5 transition-all duration-300',
                active
                  ? 'scale-[1.03] font-semibold text-foreground'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              {line.text || '♪'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
