import { useState } from 'react'
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Maximize2,
  Minimize2,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { CycleVolumeButton } from './compact-bar'
import { basename } from '@/lib/audio-extensions'
import { msToClock } from '@/lib/format-time'
import { usePlayer } from '@/store/player-store'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'
import { cn } from '@/lib/utils'

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  selectedAudio: string | null
  onPrev: () => void
  onNext: () => void
  showTrackInfo?: boolean
}

export function TransportControls({
  audioRef,
  selectedAudio,
  onPrev,
  onNext,
  showTrackInfo = true
}: Props): React.JSX.Element {
  const isPlaying = usePlayer((s) => s.isPlaying)
  const currentTimeMs = usePlayer((s) => s.currentTimeMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const shuffle = usePlayer((s) => s.shuffle)
  const loopMode = usePlayer((s) => s.loopMode)
  const setShuffle = usePlayer((s) => s.setShuffle)
  const setLoopMode = usePlayer((s) => s.setLoopMode)
  const requestSeek = usePlayer((s) => s.requestSeek)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const hydrated = useLibrary((s) => s.hydrated)
  const m = selectedAudio ? trackMeta[selectedAudio] : null

  const title = selectedAudio
    ? m?.title && m.title !== 'Unknown'
      ? m.title
      : basename(selectedAudio)
    : hydrated
      ? 'Ready to play'
      : ''
  const artist = m?.artist && m.artist !== 'Unknown' ? m.artist : null

  const [hoverMs, setHoverMs] = useState<number | null>(null)
  const [hoverLeft, setHoverLeft] = useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!selectedAudio || durationMs === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverMs(percent * durationMs)
    setHoverLeft(e.clientX - rect.left)
  }

  const handleMouseLeave = (): void => {
    setHoverMs(null)
  }

  const toggle = (): void => {
    const a = audioRef.current
    if (!a || !selectedAudio) return
    if (a.paused) {
      a.play().catch((err) => {
        console.error('[TransportControls] play failed:', err)
      })
    } else {
      a.pause()
    }
  }

  const toggleShuffle = (): void => setShuffle(!shuffle)

  const toggleLoop = (): void => {
    if (loopMode === 'off') setLoopMode('all')
    else if (loopMode === 'all') setLoopMode('one')
    else setLoopMode('off')
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Part 1: Track info (artwork only shown in full player) */}
      {showTrackInfo && (
        <div className="flex w-full max-w-xl flex-col items-center gap-0.5 px-4">
          <h2 className="line-clamp-1 text-center text-lg font-semibold tracking-tight text-foreground transition-all">
            {title}
          </h2>
          {artist && (
            <p className="line-clamp-1 text-center text-xs font-medium text-muted-foreground/70">
              {artist}
            </p>
          )}
        </div>
      )}

      {/* Part 2: Progress Bar */}
      <div className="flex w-full max-w-3xl flex-col gap-1 px-2">
        <div
          className="relative px-0.5"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {hoverMs !== null && (
            <div
              className="absolute bottom-full mb-2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background shadow-md pointer-events-none"
              style={{ left: hoverLeft }}
            >
              {msToClock(hoverMs)}
            </div>
          )}
          <Slider
            className="cursor-pointer"
            value={[currentTimeMs]}
            min={0}
            max={Math.max(durationMs, 1)}
            step={100}
            hideThumb={true}
            disabled={!selectedAudio || durationMs === 0}
            onValueChange={(v) => requestSeek(v[0])}
          />
        </div>
        <div className="flex justify-between px-0.5">
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
            {msToClock(currentTimeMs)}
          </span>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
            {msToClock(durationMs)}
          </span>
        </div>
      </div>

      {/* Part 3: Controller — buttons stay centered, volume left, expand right */}
      <div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-2">
        <div className="flex justify-start">
          <CycleVolumeButton />
        </div>
        <div className="flex items-center gap-4 md:gap-8 text-muted-foreground/80">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-9 w-9 transition-all relative',
              shuffle
                ? 'text-primary opacity-100'
                : 'text-muted-foreground/50 hover:text-foreground'
            )}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <Shuffle className="h-4.5 w-4.5" strokeWidth={2} />
            {shuffle && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 hover:text-foreground hover:bg-transparent transition-all active:scale-90"
            onClick={onPrev}
            disabled={!selectedAudio}
            title="Previous"
          >
            <SkipBack className="h-6 w-6 fill-current" />
          </Button>

          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95 shadow-lg"
            onClick={toggle}
            disabled={!selectedAudio}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current translate-x-0.5" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 hover:text-foreground hover:bg-transparent transition-all active:scale-90"
            onClick={onNext}
            disabled={!selectedAudio}
            title="Next"
          >
            <SkipForward className="h-6 w-6 fill-current" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-9 w-9 transition-all relative',
              loopMode !== 'off'
                ? 'text-primary opacity-100'
                : 'text-muted-foreground/50 hover:text-foreground'
            )}
            onClick={toggleLoop}
            title={
              loopMode === 'one' ? 'Repeat One' : loopMode === 'all' ? 'Repeat All' : 'Repeat Off'
            }
          >
            {loopMode === 'one' ? (
              <Repeat1 className="h-4.5 w-4.5" strokeWidth={2} />
            ) : (
              <Repeat className="h-4.5 w-4.5" strokeWidth={2} />
            )}
            {loopMode !== 'off' && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </Button>
        </div>
        <div className="flex justify-end">
          <StarButton selectedAudio={selectedAudio} />
        </div>
      </div>
    </div>
  )
}

function StarButton({ selectedAudio }: { selectedAudio: string | null }): React.JSX.Element {
  const likedPaths = useLibrary((s) => s.likedPaths)
  const toggleLike = useLibrary((s) => s.toggleLike)
  const liked = selectedAudio ? !!likedPaths[selectedAudio] : false

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        'h-8 w-8 transition-colors',
        liked ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
      )}
      onClick={() => selectedAudio && toggleLike(selectedAudio)}
      disabled={!selectedAudio}
      title={liked ? 'Unstar' : 'Star'}
      aria-pressed={liked}
    >
      <Star className={cn('h-4.5 w-4.5', liked && 'fill-primary')} strokeWidth={2} />
    </Button>
  )
}

export function ExpandButton(): React.JSX.Element {
  const fullPlayer = useUI((s) => s.fullPlayer)
  const toggleFullPlayer = useUI((s) => s.toggleFullPlayer)
  const Icon = fullPlayer ? Minimize2 : Maximize2

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground/60 transition-colors hover:text-foreground"
      onClick={toggleFullPlayer}
      title={fullPlayer ? 'Exit full player' : 'Full player'}
      aria-pressed={fullPlayer}
    >
      <Icon className="h-4.5 w-4.5" strokeWidth={2} />
    </Button>
  )
}

