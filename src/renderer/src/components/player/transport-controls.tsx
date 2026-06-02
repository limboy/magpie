import { useState } from 'react'
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
  VolumeX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { basename } from '@/lib/audio-extensions'
import { msToClock } from '@/lib/format-time'
import { usePlayer } from '@/store/player-store'
import { useLibrary } from '@/store/library-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { cn } from '@/lib/utils'

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
  const isPlaying = usePlayer((s) => s.isPlaying)
  const currentTimeMs = usePlayer((s) => s.currentTimeMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const shuffle = usePlayer((s) => s.shuffle)
  const loopMode = usePlayer((s) => s.loopMode)
  const setShuffle = usePlayer((s) => s.setShuffle)
  const setLoopMode = usePlayer((s) => s.setLoopMode)
  const requestSeek = usePlayer((s) => s.requestSeek)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const m = selectedAudio ? trackMeta[selectedAudio] : null
  const cover = useCoverArt(selectedAudio)

  const title = selectedAudio
    ? m?.title && m.title !== 'Unknown'
      ? m.title
      : basename(selectedAudio)
    : 'Ready to play'
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
    <div className="flex flex-col items-center">
      {/* Part 1: Cover art + track info */}
      <div className="flex w-full max-w-xl flex-col items-center gap-2.5 px-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md ring-1 ring-black/5">
          {cover ? (
            <img
              key={cover}
              src={cover}
              alt=""
              className="h-full w-full object-cover animate-in fade-in duration-500"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Music className="h-6 w-6" strokeWidth={1.75} />
            </div>
          )}
        </div>
        <div className="flex w-full flex-col items-center gap-0.5">
          <h2 className="line-clamp-1 text-center text-lg font-semibold tracking-tight text-foreground transition-all">
            {title}
          </h2>
          {artist && (
            <p className="line-clamp-1 text-center text-xs font-medium text-muted-foreground/70">
              {artist}
            </p>
          )}
        </div>
      </div>

      {/* Part 2: Progress Bar */}
      <div className="flex w-full max-w-3xl flex-col gap-1 px-8 mt-3">
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

      {/* Part 3: Controller — buttons stay centered, volume sits to the right */}
      <div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-8">
        <div />
        <div className="flex items-center gap-4 md:gap-8 text-muted-foreground/80">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-9 w-9 transition-all relative',
              shuffle ? 'text-primary opacity-100' : 'text-muted-foreground/50 hover:text-foreground'
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
              loopMode !== 'off' ? 'text-primary opacity-100' : 'text-muted-foreground/50 hover:text-foreground'
            )}
            onClick={toggleLoop}
            title={loopMode === 'one' ? 'Repeat One' : loopMode === 'all' ? 'Repeat All' : 'Repeat Off'}
          >
            {loopMode === 'one' ? (
              <Repeat1 className="h-4.5 w-4.5" strokeWidth={2} />
            ) : (
              <Repeat
                className="h-4.5 w-4.5"
                strokeWidth={2}
              />
            )}
            {loopMode !== 'off' && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </Button>
        </div>
        <div className="flex justify-end">
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}

function VolumeControl(): React.JSX.Element {
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const setVolume = usePlayer((s) => s.setVolume)
  const setMuted = usePlayer((s) => s.setMuted)

  const effective = muted ? 0 : volume
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2

  return (
    <div className="group relative flex items-center">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground/60 hover:text-foreground transition-colors"
        onClick={() => setMuted(!muted)}
        title={muted ? 'Unmute' : 'Mute'}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
      </Button>
      <div className="absolute bottom-full left-1/2 z-50 hidden -translate-x-1/2 flex-col items-center rounded-full border bg-popover px-2 py-3 shadow-lg group-hover:flex">
        <Slider
          orientation="vertical"
          className="data-[orientation=vertical]:min-h-24 h-24"
          value={[Math.round(effective * 100)]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => {
            const next = v[0] / 100
            setVolume(next)
            if (muted && next > 0) setMuted(false)
          }}
        />
      </div>
    </div>
  )
}
