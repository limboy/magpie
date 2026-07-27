import { create } from 'zustand'

type LoopMode = 'off' | 'one' | 'all'

type PlayerState = {
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  volume: number
  rate: number
  muted: boolean
  shuffle: boolean
  loopMode: LoopMode
  seekRequestMs: number | null
  setPlaying: (playing: boolean) => void
  setCurrentTimeMs: (ms: number) => void
  setDurationMs: (ms: number) => void
  setVolume: (v: number) => void
  setRate: (r: number) => void
  setMuted: (m: boolean) => void
  setShuffle: (shuffle: boolean) => void
  setLoopMode: (mode: LoopMode) => void
  requestSeek: (ms: number) => void
  clearSeekRequest: () => void
}

export const usePlayer = create<PlayerState>((set) => ({
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 0,
  volume: 1,
  rate: 1,
  muted: false,
  shuffle: false,
  loopMode: 'off',
  seekRequestMs: null,
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
  setDurationMs: (durationMs) => set({ durationMs }),
  setVolume: (volume) => set({ volume }),
  setRate: (rate) => set({ rate }),
  setMuted: (muted) => set({ muted }),
  setShuffle: (shuffle) => set({ shuffle }),
  setLoopMode: (loopMode) => set({ loopMode }),
  requestSeek: (ms) => set({ seekRequestMs: ms }),
  clearSeekRequest: () => set({ seekRequestMs: null })
}))
