import { Music } from 'lucide-react'
import { basename } from '@/lib/audio-extensions'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { useLyrics } from '@/hooks/use-lyrics'
import { LyricsPanel } from './lyrics-panel'
import { TransportControls } from './transport-controls'

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  selectedAudio: string | null
  onPrev: () => void
  onNext: () => void
}

export function FullPlayer({ audioRef, selectedAudio, onPrev, onNext }: Props): React.JSX.Element {
  const cover = useCoverArt(selectedAudio)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const hydrated = useLibrary((s) => s.hydrated)
  const trackDurations = useLibrary((s) => s.trackDurations)
  const durationMs = usePlayer((s) => s.durationMs)
  const currentTimeMs = usePlayer((s) => s.currentTimeMs)
  const requestSeek = usePlayer((s) => s.requestSeek)

  const meta = selectedAudio ? trackMeta[selectedAudio] : null
  const title = selectedAudio
    ? meta?.title && meta.title !== 'Unknown'
      ? meta.title
      : basename(selectedAudio)
    : hydrated
      ? 'Ready to play'
      : ''
  const artist = meta?.artist && meta.artist !== 'Unknown' ? meta.artist : ''
  const album = meta?.album && meta.album !== 'Unknown' ? meta.album : ''

  const effectiveDuration =
    durationMs || (selectedAudio ? (trackDurations[selectedAudio] ?? null) : null)
  const lyrics = useLyrics(selectedAudio, title, artist, album, effectiveDuration)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Artwork + track info */}
      <div className="flex shrink-0 flex-col items-center gap-3 px-8 pb-2 pt-6">
        <div className="relative size-40 overflow-hidden rounded-2xl bg-muted shadow-xl ring-1 ring-black/5 @lg:size-52">
          {cover ? (
            <img
              key={cover}
              src={cover}
              alt=""
              className="h-full w-full object-cover animate-in fade-in duration-500"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
              <Music className="h-12 w-12" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="flex max-w-md flex-col items-center gap-0.5 text-center">
          <h1 className="line-clamp-2 text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {artist && <p className="line-clamp-1 text-sm text-muted-foreground">{artist}</p>}
          {album && <p className="line-clamp-1 text-xs text-muted-foreground/60">{album}</p>}
        </div>
      </div>

      {/* Lyrics — between the artwork and the controller */}
      <div className="flex min-h-0 flex-1 flex-col">
        <LyricsPanel state={lyrics} currentTimeMs={currentTimeMs} onSeek={requestSeek} />
      </div>

      {/* Transport */}
      <div className="shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur-md">
        <TransportControls
          audioRef={audioRef}
          selectedAudio={selectedAudio}
          onPrev={onPrev}
          onNext={onNext}
          showTrackInfo={false}
        />
      </div>
    </div>
  )
}
