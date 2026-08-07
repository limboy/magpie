import { useCallback, useEffect, useRef } from 'react'
import { basename, pathToLocalUrl } from '@/lib/audio-extensions'
import { secondsToMs } from '@/lib/format-time'
import { useLibrary } from '@/store/library-store'
import { usePlayer } from '@/store/player-store'
import { useUI } from '@/store/ui-store'
import { CoverPanel } from './cover-panel'
import { TransportControls } from './transport-controls'

export function AudioPlayer(): React.JSX.Element {
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
  const coverPanelView = useUI((s) => s.coverPanelView)

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

  const lastAudioPositions = useLibrary((s) => s.lastAudioPositions)
  const saveAudioPosition = useLibrary((s) => s.saveAudioPosition)
  const lastSavedTimeRef = useRef<number>(0)
  const initialRestoredRef = useRef<string | null>(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (seekRequestMs == null) return
    a.currentTime = seekRequestMs / 1000
    setCurrentTimeMs(seekRequestMs)
    if (selectedAudio) {
      lastSavedTimeRef.current = seekRequestMs
      saveAudioPosition(selectedAudio, seekRequestMs)
    }
    clearSeekRequest()
  }, [seekRequestMs, clearSeekRequest, setCurrentTimeMs, selectedAudio, saveAudioPosition])

  useEffect(() => {
    const a = audioRef.current
    if (!a || !selectedAudio) return

    const savedPosMs = lastAudioPositions[selectedAudio] ?? 0
    if (initialRestoredRef.current !== selectedAudio) {
      initialRestoredRef.current = selectedAudio
      if (savedPosMs > 0) {
        a.currentTime = savedPosMs / 1000
        setCurrentTimeMs(savedPosMs)
        lastSavedTimeRef.current = savedPosMs
      } else {
        setCurrentTimeMs(0)
        setDurationMs(0)
        lastSavedTimeRef.current = 0
      }
    }
  }, [selectedAudio, lastAudioPositions, setCurrentTimeMs, setDurationMs])

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const a = audioRef.current
      if (a && selectedAudio) {
        const ms = secondsToMs(a.currentTime)
        saveAudioPosition(selectedAudio, ms)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedAudio, saveAudioPosition])

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

  const shuffle = usePlayer((s) => s.shuffle)
  const loopMode = usePlayer((s) => s.loopMode)

  const onNext = useCallback(
    (forcePlay = false): void => {
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
    },
    [
      orderedPaths,
      activeCollection,
      collections,
      selectedAudio,
      shuffle,
      loopMode,
      isPlaying,
      selectAudio,
      setPlaying
    ]
  )

  const onPrev = useCallback((): void => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTimeMs(0)
      if (selectedAudio) saveAudioPosition(selectedAudio, 0)
      return
    }

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
  }, [
    orderedPaths,
    activeCollection,
    collections,
    selectedAudio,
    shuffle,
    isPlaying,
    selectAudio,
    setPlaying,
    setCurrentTimeMs,
    saveAudioPosition
  ])

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
        album: m?.album && m.album !== 'Unknown' ? m.album : 'Unknown Album'
      })

      navigator.mediaSession.setActionHandler('play', () => setPlaying(true))
      navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
      navigator.mediaSession.setActionHandler('previoustrack', onPrev)
      navigator.mediaSession.setActionHandler('nexttrack', () => onNext(false))
    }
  }, [selectedAudio, trackMeta, setPlaying, onPrev, onNext])

  return (
    <section className="shrink-0 border-b bg-background/95 backdrop-blur-md">
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
          const a = audioRef.current
          if (a && selectedAudio) {
            const ms = secondsToMs(a.currentTime)
            lastSavedTimeRef.current = ms
            saveAudioPosition(selectedAudio, ms)
          }
        }}
        onEnded={() => {
          console.log('[AudioPlayer] ended')
          if (selectedAudio) {
            saveAudioPosition(selectedAudio, 0)
          }
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
        onLoadedMetadata={() => {
          console.log('[AudioPlayer] loadedmetadata')
          const a = audioRef.current
          if (a && selectedAudio) {
            const savedPosMs = lastAudioPositions[selectedAudio] ?? 0
            if (savedPosMs > 0 && Math.abs(a.currentTime - savedPosMs / 1000) > 0.5) {
              a.currentTime = savedPosMs / 1000
              setCurrentTimeMs(savedPosMs)
            }
          }
        }}
        onCanPlay={() => {
          console.log('[AudioPlayer] canplay')
          const a = audioRef.current
          if (a && selectedAudio) {
            const savedPosMs = lastAudioPositions[selectedAudio] ?? 0
            if (savedPosMs > 0 && Math.abs(a.currentTime - savedPosMs / 1000) > 0.5) {
              a.currentTime = savedPosMs / 1000
              setCurrentTimeMs(savedPosMs)
            }
          }
          if (isPlaying) {
            audioRef.current?.play().catch(console.error)
          }
        }}
        onTimeUpdate={(e) => {
          const sec = e.currentTarget.currentTime
          const ms = secondsToMs(sec)
          setCurrentTimeMs(ms)
          if (selectedAudio && ms > 0) {
            if (Math.abs(ms - lastSavedTimeRef.current) >= 2000) {
              lastSavedTimeRef.current = ms
              saveAudioPosition(selectedAudio, ms)
            }
          }
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          console.log('[AudioPlayer] durationchange:', d)
          setDurationMs(Number.isFinite(d) ? secondsToMs(d) : 0)
        }}
        onSeeked={(e) => {
          console.log('[AudioPlayer] seeked:', e.currentTarget.currentTime)
          const ms = secondsToMs(e.currentTarget.currentTime)
          setCurrentTimeMs(ms)
          if (selectedAudio) {
            lastSavedTimeRef.current = ms
            saveAudioPosition(selectedAudio, ms)
          }
        }}
      />
      {coverPanelView !== 'hidden' && (
        <CoverPanel selectedAudio={selectedAudio} view={coverPanelView} />
      )}
      <TransportControls
        audioRef={audioRef}
        selectedAudio={selectedAudio}
        onPrev={onPrev}
        onNext={onNext}
      />
    </section>
  )
}
