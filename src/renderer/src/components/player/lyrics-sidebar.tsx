import { basename } from '@/lib/audio-extensions'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
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
    <aside className="flex w-72 shrink-0 flex-col border-l bg-muted/40 backdrop-blur-sm">
      <LyricsPanel state={lyrics} currentTimeMs={currentTimeMs} onSeek={requestSeek} />
    </aside>
  )
}
