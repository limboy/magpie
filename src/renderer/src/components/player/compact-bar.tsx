import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music,
  Star,
  Volume2,
  Volume1,
  VolumeX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { basename } from '@/lib/audio-extensions'
import { usePlayer } from '@/store/player-store'
import { useLibrary } from '@/store/library-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { cn } from '@/lib/utils'
import { ExpandButton } from './transport-controls'

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  selectedAudio: string | null
  onPrev: () => void
  onNext: () => void
}

export function CompactBar({ audioRef, selectedAudio, onPrev, onNext }: Props): React.JSX.Element {
  const isPlaying = usePlayer((s) => s.isPlaying)
  const shuffle = usePlayer((s) => s.shuffle)
  const loopMode = usePlayer((s) => s.loopMode)
  const setShuffle = usePlayer((s) => s.setShuffle)
  const setLoopMode = usePlayer((s) => s.setLoopMode)

  const toggle = (): void => {
    const a = audioRef.current
    if (!a || !selectedAudio) return
    if (a.paused) {
      a.play().catch((err) => console.error('[CompactBar] play failed:', err))
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
    <div className="flex items-center gap-3">
      {/* Left: transport */}
      <div className="flex shrink-0 items-center gap-1 text-foreground">
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'h-8 w-8 transition-colors',
            shuffle ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground'
          )}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <Shuffle className="h-4 w-4" strokeWidth={2} />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-foreground hover:bg-transparent active:scale-90"
          onClick={onPrev}
          disabled={!selectedAudio}
          title="Previous"
        >
          <SkipBack className="h-5 w-5 fill-current" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 text-foreground hover:bg-transparent active:scale-90"
          onClick={toggle}
          disabled={!selectedAudio}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 translate-x-0.5 fill-current" />
          )}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-foreground hover:bg-transparent active:scale-90"
          onClick={onNext}
          disabled={!selectedAudio}
          title="Next"
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'h-8 w-8 transition-colors',
            loopMode !== 'off' ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground'
          )}
          onClick={toggleLoop}
          title={
            loopMode === 'one' ? 'Repeat One' : loopMode === 'all' ? 'Repeat All' : 'Repeat Off'
          }
        >
          {loopMode === 'one' ? (
            <Repeat1 className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Repeat className="h-4 w-4" strokeWidth={2} />
          )}
        </Button>
      </div>

      {/* Center: now-playing "LCD" */}
      <NowPlaying selectedAudio={selectedAudio} />

      {/* Right: volume + expand */}
      <div className="flex shrink-0 items-center gap-0.5">
        <CycleVolumeButton />
        <ExpandButton />
      </div>
    </div>
  )
}

// Click cycles through 100% → 75% → 50% → 25% → mute → 100% …
const VOLUME_STEPS = [1, 0.75, 0.5, 0.25, 0] as const

function CycleVolumeButton(): React.JSX.Element {
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const setVolume = usePlayer((s) => s.setVolume)
  const setMuted = usePlayer((s) => s.setMuted)

  const effective = muted ? 0 : volume
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2

  const cycle = (): void => {
    // Snap the current level to the nearest defined step, then advance one.
    const idx = VOLUME_STEPS.reduce<number>(
      (best, step, i) =>
        Math.abs(step - effective) < Math.abs(VOLUME_STEPS[best] - effective) ? i : best,
      0
    )
    const next = VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length]
    if (next === 0) {
      setMuted(true)
    } else {
      setVolume(next)
      if (muted) setMuted(false)
    }
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground/60 transition-colors hover:text-foreground"
      onClick={cycle}
      title={`Volume ${Math.round(effective * 100)}%`}
    >
      <Icon className="h-4.5 w-4.5" strokeWidth={2} />
    </Button>
  )
}

function NowPlaying({ selectedAudio }: { selectedAudio: string | null }): React.JSX.Element {
  const currentTimeMs = usePlayer((s) => s.currentTimeMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const hydrated = useLibrary((s) => s.hydrated)
  const likedPaths = useLibrary((s) => s.likedPaths)
  const toggleLike = useLibrary((s) => s.toggleLike)
  const cover = useCoverArt(selectedAudio)

  const m = selectedAudio ? trackMeta[selectedAudio] : null
  const title = selectedAudio
    ? m?.title && m.title !== 'Unknown'
      ? m.title
      : basename(selectedAudio)
    : hydrated
      ? 'Ready to play'
      : ''
  const artist = m?.artist && m.artist !== 'Unknown' ? m.artist : null
  const liked = selectedAudio ? !!likedPaths[selectedAudio] : false

  const progress = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0

  return (
    <div className="relative mx-auto min-w-0 max-w-2xl flex-1">
      <div className="group relative flex h-12 items-center gap-3 overflow-hidden rounded-lg border border-border/40 bg-muted/50 pl-2 pr-3">
        {/* Artwork */}
        <div className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
          {cover ? (
            <img key={cover} src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Music className="h-4 w-4" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Title + artist */}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold leading-tight text-foreground">
            {title}
          </div>
          {artist && (
            <div className="truncate text-xs leading-tight text-muted-foreground/70">{artist}</div>
          )}
        </div>

        {/* Star */}
        <button
          className={cn(
            'shrink-0 rounded-full p-1 transition-colors',
            liked ? 'text-primary' : 'text-muted-foreground/40 hover:text-foreground'
          )}
          onClick={() => selectedAudio && toggleLike(selectedAudio)}
          disabled={!selectedAudio}
          title={liked ? 'Unstar' : 'Star'}
        >
          <Star className={cn('h-4 w-4', liked && 'fill-primary')} />
        </button>

        {/* Thin progress indicator pinned to the bottom edge (non-interactive) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-border/60">
          <div className="h-full bg-foreground/70" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
