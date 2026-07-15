import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePlayer } from '@/store/player-store'

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  selectedAudio: string | null
  onPrev: () => void
  onNext: () => void
}

export function TransportControls({
  audioRef,
  selectedAudio,
  onPrev,
  onNext
}: Props): React.JSX.Element {
  const isPlaying = usePlayer((state) => state.isPlaying)
  const currentTimeMs = usePlayer((state) => state.currentTimeMs)
  const durationMs = usePlayer((state) => state.durationMs)
  const requestSeek = usePlayer((state) => state.requestSeek)
  const progress =
    durationMs > 0 ? Math.max(0, Math.min(100, (currentTimeMs / durationMs) * 100)) : 0
  const togglePlayback = (): void => {
    const audio = audioRef.current
    if (!audio || !selectedAudio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const seekBy = (deltaMs: number): void => {
    if (!selectedAudio) return
    requestSeek(Math.max(0, Math.min(durationMs, currentTimeMs + deltaMs)))
  }

  return (
    <div className="relative flex flex-col">
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/20 px-4">
        <div className="flex justify-start">
          <ShuffleButton />
        </div>

        <div className="flex items-center justify-center gap-3">
          <SeekButton
            seconds={5}
            direction="back"
            onClick={() => seekBy(-5000)}
            disabled={!selectedAudio}
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-full text-foreground"
            onClick={onPrev}
            disabled={!selectedAudio}
            aria-label="Previous song"
            title="Previous"
          >
            <SkipBack className="size-4.5 fill-current" />
          </Button>
          <Button
            size="icon"
            className="size-10 rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90"
            onClick={togglePlayback}
            disabled={!selectedAudio}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="size-5 translate-x-px fill-current" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-full text-foreground"
            onClick={onNext}
            disabled={!selectedAudio}
            aria-label="Next song"
            title="Next"
          >
            <SkipForward className="size-4.5 fill-current" />
          </Button>
          <SeekButton
            seconds={15}
            direction="forward"
            onClick={() => seekBy(15000)}
            disabled={!selectedAudio}
          />
        </div>

        <div className="flex justify-end">
          <RepeatModeButton />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-px overflow-hidden bg-border/40">
        <div
          className="h-full bg-foreground/75 transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function ShuffleButton(): React.JSX.Element {
  const shuffle = usePlayer((state) => state.shuffle)
  const setShuffle = usePlayer((state) => state.setShuffle)

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        'relative size-8 rounded-full',
        shuffle ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={() => setShuffle(!shuffle)}
      aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
      aria-pressed={shuffle}
      title={shuffle ? 'Shuffle on' : 'Shuffle off'}
    >
      <Shuffle className="size-4" />
      {shuffle && (
        <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />
      )}
    </Button>
  )
}

function RepeatModeButton(): React.JSX.Element {
  const loopMode = usePlayer((state) => state.loopMode)
  const setLoopMode = usePlayer((state) => state.setLoopMode)
  const Icon = loopMode === 'one' ? Repeat1 : Repeat
  const label = loopMode === 'one' ? 'Repeat one' : loopMode === 'all' ? 'Repeat all' : 'Repeat off'

  const cycleRepeat = (): void => {
    if (loopMode === 'off') setLoopMode('all')
    else if (loopMode === 'all') setLoopMode('one')
    else setLoopMode('off')
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        'relative size-8 rounded-full',
        loopMode === 'off' ? 'text-muted-foreground hover:text-foreground' : 'text-foreground'
      )}
      onClick={cycleRepeat}
      aria-label={`${label}; click to switch repeat mode`}
      aria-pressed={loopMode !== 'off'}
      title={label}
    >
      <Icon className="size-4" />
      {loopMode !== 'off' && (
        <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />
      )}
    </Button>
  )
}

function SeekButton({
  seconds,
  direction,
  onClick,
  disabled
}: {
  seconds: number
  direction: 'back' | 'forward'
  onClick: () => void
  disabled: boolean
}): React.JSX.Element {
  const Icon = direction === 'back' ? RotateCcw : RotateCw

  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative size-8 rounded-full text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === 'back' ? 'Back' : 'Forward'} ${seconds} seconds`}
      title={`${direction === 'back' ? 'Back' : 'Forward'} ${seconds} seconds`}
    >
      <Icon className="size-4.5" strokeWidth={1.8} />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pt-px text-[7px] font-semibold tabular-nums">
        {seconds}
      </span>
    </Button>
  )
}
