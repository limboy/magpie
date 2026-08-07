import { Music } from 'lucide-react'
import { basename } from '@/lib/audio-extensions'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { useLyrics } from '@/hooks/use-lyrics'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
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
  const showCover = useUI((s) => s.coverPanelView !== 'hidden')
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
      {/* Track info */}
      <div className="flex shrink-0 flex-col items-center gap-0.5 px-8 pb-2 pt-6 text-center">
        <h1 className="line-clamp-2 max-w-md text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {artist && <p className="line-clamp-1 text-sm text-muted-foreground">{artist}</p>}
        {album && <p className="line-clamp-1 text-xs text-muted-foreground/60">{album}</p>}
      </div>

      {/* Lyrics, with the cover — resizable — sitting just above the controller */}
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel
          id="lyrics"
          minSize={20}
          className="flex h-full flex-col"
          style={{ overflow: 'hidden' }}
        >
          <LyricsPanel state={lyrics} currentTimeMs={currentTimeMs} onSeek={requestSeek} />
        </ResizablePanel>
        {showCover && (
          <>
            <ResizableHandle />
            <ResizablePanel id="cover" defaultSize={38} minSize={15} maxSize={70}>
              <div className="flex h-full w-full items-center justify-center overflow-hidden p-4">
                {cover ? (
                  <img
                    key={cover}
                    src={cover}
                    alt=""
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-xl ring-1 ring-black/5 animate-in fade-in duration-500"
                  />
                ) : (
                  <div className="flex size-40 items-center justify-center rounded-2xl bg-muted text-muted-foreground/30">
                    <Music className="h-12 w-12" strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Transport */}
      <div className="shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur-md">
        <TransportControls
          audioRef={audioRef}
          selectedAudio={selectedAudio}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
    </div>
  )
}
