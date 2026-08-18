import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music,
  Volume2,
  Volume1,
  VolumeX,
  MessageSquareQuote,
  Maximize2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { basename } from '@/lib/audio-extensions'
import { usePlayer } from '@/store/player-store'
import { useLibrary } from '@/store/library-store'
import { useUI } from '@/store/ui-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { cn } from '@/lib/utils'
import { audioMarkLabel, nextAudioMark } from '@/lib/audio-mark'
import { AudioMarkIcon } from './audio-mark-icon'

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
            'h-8 w-8 transition-colors relative',
            shuffle ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground'
          )}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <Shuffle className="h-4 w-4" strokeWidth={2} />
          {shuffle && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
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
          className="h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95 shadow-lg"
          onClick={toggle}
          disabled={!selectedAudio}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="h-6 w-6 translate-x-0.5 fill-current" />
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
            'h-8 w-8 transition-colors relative',
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
          {loopMode !== 'off' && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </Button>
      </div>

      {/* Center: now-playing "LCD" */}
      <NowPlaying selectedAudio={selectedAudio} />

      {/* Right: lyrics + volume */}
      <div className="flex shrink-0 items-center gap-0.5">
        <LyricsButton />
        <CycleVolumeButton />
      </div>
    </div>
  )
}

function LyricsButton(): React.JSX.Element {
  const lyricsOpen = useUI((s) => s.mainView === 'lyrics')
  const toggleLyricsView = useUI((s) => s.toggleLyricsView)

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        'h-8 w-8 transition-colors',
        lyricsOpen ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
      )}
      onClick={toggleLyricsView}
      title="Lyrics"
      aria-pressed={lyricsOpen}
    >
      <MessageSquareQuote className="h-4.5 w-4.5" strokeWidth={2} />
    </Button>
  )
}

// Click cycles through 100% → 75% → 50% → 25% → mute → 100% …
const VOLUME_STEPS = [1, 0.75, 0.5, 0.25, 0] as const

export function CycleVolumeButton(): React.JSX.Element {
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
  const audioMarks = useLibrary((s) => s.audioMarks)
  const cycleAudioMark = useLibrary((s) => s.cycleAudioMark)
  const toggleFullPlayer = useUI((s) => s.toggleFullPlayer)
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
  const mark = selectedAudio ? (audioMarks[selectedAudio] ?? null) : null

  const progress = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0

  return (
    <div className="relative mx-auto min-w-0 max-w-2xl flex-1">
      <div className="group relative flex h-12 items-center gap-3 rounded-lg border border-border/40 bg-muted/50 p-2">
        {/* Artwork — hovering reveals the full-player expander */}
        <button
          type="button"
          className="group/cover relative size-8 shrink-0 overflow-hidden rounded-md bg-muted"
          onClick={toggleFullPlayer}
          title="Full player"
          aria-label="Full player"
        >
          {cover ? (
            <img key={cover} src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Music className="h-4 w-4" strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/45 opacity-0 transition-opacity group-hover/cover:opacity-100">
            <Maximize2 className="h-3.5 w-3.5 text-background" strokeWidth={2.5} />
          </div>
        </button>

        {/* Title + artist */}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold leading-tight text-foreground">
            {title}
          </div>
          {artist && (
            <div className="truncate text-xs leading-tight text-muted-foreground/70">{artist}</div>
          )}
        </div>

        {/* Audio mark */}
        <button
          className={cn(
            'shrink-0 rounded-full p-1 transition-colors',
            mark ? 'text-primary' : 'text-muted-foreground/40 hover:text-foreground'
          )}
          onClick={() => selectedAudio && cycleAudioMark(selectedAudio)}
          disabled={!selectedAudio}
          aria-label={`${audioMarkLabel(mark)} song; click for ${audioMarkLabel(nextAudioMark(mark))}`}
          title={`${audioMarkLabel(mark)} · Next: ${audioMarkLabel(nextAudioMark(mark))}`}
        >
          <AudioMarkIcon mark={mark} className="h-4 w-4" />
        </button>

        {/* Thin progress indicator near the bottom edge (non-interactive),
            inset so it clears the card's rounded corners */}
        <div className="pointer-events-none absolute inset-x-2 -bottom-px z-50 h-px overflow-hidden rounded-full bg-border/60">
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
