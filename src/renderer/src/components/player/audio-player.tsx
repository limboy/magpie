import { useCallback, useEffect, useRef } from 'react'
import { basename, pathToLocalUrl } from '@/lib/audio-extensions'
import { secondsToMs } from '@/lib/format-time'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'
import { useCoverArt } from '@/hooks/use-cover-art'
import { cn } from '@/lib/utils'
import { TransportControls } from './transport-controls'
import { FullPlayer } from './full-player'

export function AudioPlayer({ fullPlayer = false }: { fullPlayer?: boolean }): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  const selectedAudio = useLibrary((s) => s.selectedAudio)
  const collections = useLibrary((s) => s.collections)
  const selectedCollectionId = useLibrary((s) => s.selectedCollectionId)
  const selectAudio = useLibrary((s) => s.selectAudio)
  const orderedPaths = useLibrary((s) => s.orderedPaths)

  const activeCollection = collections.find((c) => c.id === selectedCollectionId)

  const isPlaying = usePlayer((s) => s.isPlaying)
  const setPlaying = usePlayer((s) => s.setPlaying)
  const setCurrentTimeMs = usePlayer((s) => s.setCurrentTimeMs)
  const setDurationMs = usePlayer((s) => s.setDurationMs)
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const rate = usePlayer((s) => s.rate)
  const seekRequestMs = usePlayer((s) => s.seekRequestMs)
  const clearSeekRequest = usePlayer((s) => s.clearSeekRequest)
  const trackMeta = useLibrary((s) => s.trackMeta)
  
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (isPlaying) {
      if (a.paused) a.play().catch(console.error)
    } else {
      if (!a.paused) a.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
  }, [volume])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = muted
  }, [muted])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.playbackRate = rate
  }, [rate])

  useEffect(() => {
    const a = audioRef.current
    if (!a || seekRequestMs == null) return
    a.currentTime = seekRequestMs / 1000
    setCurrentTimeMs(seekRequestMs)
    clearSeekRequest()
  }, [seekRequestMs, clearSeekRequest, setCurrentTimeMs])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    setCurrentTimeMs(0)
    setDurationMs(0)
  }, [selectedAudio, setCurrentTimeMs, setDurationMs])

  useEffect(() => {
    if (!selectedAudio) return
    const checkCurrent = async (): Promise<void> => {
      const info = await window.soundbox.getPathInfo(selectedAudio).catch(() => null)
      if (!info) {
        selectAudio(null)
        void window.soundbox.setState({ lastAudioPath: null })
      }
    }
    const handleFocus = (): void => {
      void checkCurrent()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedAudio, selectAudio])

  const cover = useCoverArt(selectedAudio)
  const shuffle = usePlayer((s) => s.shuffle)
  const loopMode = usePlayer((s) => s.loopMode)

  const onNext = useCallback((forcePlay = false): void => {
    // Navigate the visible (sorted + filtered) order the user sees.
    let list = orderedPaths.length > 0 ? orderedPaths : (activeCollection?.items ?? [])
    let idx = selectedAudio ? list.indexOf(selectedAudio) : -1

    // Fall back to the raw collection order if the current track isn't visible.
    if (idx === -1 && selectedAudio) {
      list = activeCollection?.items ?? []
      idx = list.indexOf(selectedAudio)
    }

    // If still not found, search other collections.
    if (idx === -1 && selectedAudio) {
      for (const c of collections) {
        const i = c.items.indexOf(selectedAudio)
        if (i !== -1) {
          list = c.items
          idx = i
          break
        }
      }
    }

    if (idx === -1 || list.length === 0) return

    let nextIdx: number
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * list.length)
      if (nextIdx === idx && list.length > 1) {
        nextIdx = (nextIdx + 1) % list.length
      }
    } else {
      nextIdx = idx + 1
      if (nextIdx >= list.length) {
        if (loopMode === 'all') {
          nextIdx = 0
        } else if (forcePlay) {
          // Reached end during auto-play
          setPlaying(false)
          return
        } else {
          // Manual click next at end of list, wrap around anyway
          nextIdx = 0
        }
      }
    }

    const next = list[nextIdx]
    selectAudio(next)
    void window.soundbox.setState({ lastAudioPath: next })
    
    // If auto-play ended, we definitely want to play the next one.
    // If it was already playing, we also want to keep playing.
    if (forcePlay || isPlaying) {
      setPlaying(true)
    }
  }, [orderedPaths, activeCollection, collections, selectedAudio, shuffle, loopMode, isPlaying, selectAudio, setPlaying])

  const onPrev = useCallback((): void => {
    let list = orderedPaths.length > 0 ? orderedPaths : (activeCollection?.items ?? [])
    let idx = selectedAudio ? list.indexOf(selectedAudio) : -1

    if (idx === -1 && selectedAudio) {
      list = activeCollection?.items ?? []
      idx = list.indexOf(selectedAudio)
    }

    if (idx === -1 && selectedAudio) {
      for (const c of collections) {
        const i = c.items.indexOf(selectedAudio)
        if (i !== -1) {
          list = c.items
          idx = i
          break
        }
      }
    }

    if (idx === -1 || list.length === 0) return

    let prevIdx: number
    if (shuffle) {
      prevIdx = Math.floor(Math.random() * list.length)
      if (prevIdx === idx && list.length > 1) {
        prevIdx = (prevIdx + 1) % list.length
      }
    } else {
      prevIdx = (idx - 1 + list.length) % list.length
    }

    const prev = list[prevIdx]
    selectAudio(prev)
    void window.soundbox.setState({ lastAudioPath: prev })
    
    if (isPlaying) {
      setPlaying(true)
    }
  }, [orderedPaths, activeCollection, collections, selectedAudio, shuffle, isPlaying, selectAudio, setPlaying])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          setPlaying(!isPlaying)
          break
        case ',':
        case '<':
          onPrev()
          break
        case '.':
        case '>':
          onNext()
          break
        case 'ArrowRight': {
          e.preventDefault()
          const a = audioRef.current
          if (a && Number.isFinite(a.duration)) {
            const next = Math.min(a.duration, a.currentTime + 5)
            usePlayer.getState().requestSeek(secondsToMs(next))
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const a = audioRef.current
          if (a) {
            const next = Math.max(0, a.currentTime - 5)
            usePlayer.getState().requestSeek(secondsToMs(next))
          }
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const p = usePlayer.getState()
          p.setVolume(Math.min(1, Math.round((p.volume + 0.05) * 100) / 100))
          if (p.muted) p.setMuted(false)
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const p = usePlayer.getState()
          p.setVolume(Math.max(0, Math.round((p.volume - 0.05) * 100) / 100))
          if (p.muted) p.setMuted(false)
          break
        }
        case 'm':
        case 'M': {
          const p = usePlayer.getState()
          p.setMuted(!p.muted)
          break
        }
        case 'l':
        case 'L':
          if (selectedAudio) useLibrary.getState().toggleLike(selectedAudio)
          break
        case '/':
          e.preventDefault()
          useUI.getState().setIsSearchOpen(true)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, setPlaying, onPrev, onNext, selectedAudio])

  useEffect(() => {
    if ('mediaSession' in navigator && selectedAudio) {
      const m = trackMeta[selectedAudio]
      navigator.mediaSession.metadata = new MediaMetadata({
        title: m?.title && m.title !== 'Unknown' ? m.title : basename(selectedAudio),
        artist: m?.artist && m.artist !== 'Unknown' ? m.artist : 'Unknown Artist',
        album: m?.album && m.album !== 'Unknown' ? m.album : 'Unknown Album',
        artwork: cover ? [{ src: cover }] : undefined
      })

      navigator.mediaSession.setActionHandler('play', () => setPlaying(true))
      navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
      navigator.mediaSession.setActionHandler('previoustrack', onPrev)
      navigator.mediaSession.setActionHandler('nexttrack', () => onNext(false))
    }
  }, [selectedAudio, trackMeta, cover, setPlaying, onPrev, onNext])

  return (
    <div
      className={cn(
        fullPlayer
          ? 'flex min-h-0 flex-1 flex-col bg-background'
          : 'shrink-0 border-b bg-background/95 px-4 py-4 backdrop-blur-md'
      )}
    >
      <audio
        ref={audioRef}
        src={selectedAudio ? pathToLocalUrl(selectedAudio) : undefined}
        preload="auto"
        autoPlay={isPlaying}
        onPlay={() => {
          console.log('[AudioPlayer] play')
          setPlaying(true)
        }}
        onPause={() => {
          console.log('[AudioPlayer] pause')
          setPlaying(false)
        }}
        onEnded={() => {
          console.log('[AudioPlayer] ended')
          if (loopMode === 'one') {
            const a = audioRef.current
            if (a) {
              a.currentTime = 0
              a.play().catch(console.error)
              setPlaying(true)
            }
          } else {
            onNext(true)
          }
        }}
        onError={(e) => {
          const err = e.currentTarget.error
          console.error('[AudioPlayer] error:', {
            code: err?.code,
            message: err?.message,
            src: e.currentTarget.src
          })
        }}
        onLoadStart={() => console.log('[AudioPlayer] loadstart', selectedAudio)}
        onLoadedMetadata={() => console.log('[AudioPlayer] loadedmetadata')}
        onCanPlay={() => {
          console.log('[AudioPlayer] canplay')
          if (isPlaying) {
            audioRef.current?.play().catch(console.error)
          }
        }}
        onTimeUpdate={(e) => setCurrentTimeMs(secondsToMs(e.currentTarget.currentTime))}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          console.log('[AudioPlayer] durationchange:', d)
          setDurationMs(Number.isFinite(d) ? secondsToMs(d) : 0)
        }}
        onSeeked={(e) => {
          console.log('[AudioPlayer] seeked:', e.currentTarget.currentTime)
          setCurrentTimeMs(secondsToMs(e.currentTarget.currentTime))
        }}
      />
      {fullPlayer ? (
        <FullPlayer
          audioRef={audioRef}
          selectedAudio={selectedAudio}
          onPrev={onPrev}
          onNext={onNext}
        />
      ) : (
        <TransportControls
          audioRef={audioRef}
          selectedAudio={selectedAudio}
          onPrev={onPrev}
          onNext={onNext}
        />
      )}
    </div>
  )
}
