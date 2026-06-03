import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { basename } from '@/lib/audio-extensions'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'
import { useLyrics } from '@/hooks/use-lyrics'
import { LyricsPanel } from './lyrics-panel'

export function LyricsSidebar(): React.JSX.Element {
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const trackMeta = useLibrary((s) => s.trackMeta)
  const trackDurations = useLibrary((s) => s.trackDurations)
  const hydrated = useLibrary((s) => s.hydrated)
  const durationMs = usePlayer((s) => s.durationMs)
  const currentTimeMs = usePlayer((s) => s.currentTimeMs)
  const requestSeek = usePlayer((s) => s.requestSeek)
  const toggleLyricsSidebar = useUI((s) => s.toggleLyricsSidebar)

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
    <aside className="flex w-80 shrink-0 flex-col border-l bg-muted/40 backdrop-blur-sm @xl:w-80">
      <div className="app-drag flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Lyrics
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="app-no-drag size-6 text-muted-foreground/60 hover:text-foreground"
          onClick={toggleLyricsSidebar}
          aria-label="Close lyrics"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <LyricsPanel state={lyrics} currentTimeMs={currentTimeMs} onSeek={requestSeek} />
    </aside>
  )
}
