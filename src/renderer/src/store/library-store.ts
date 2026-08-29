import { create } from 'zustand'
import { basename } from '@/lib/audio-extensions'
import type { AudioMark, Collection } from '../../../preload/soundbox'
import { nextAudioMark } from '@/lib/audio-mark'
import { usePlayer } from './player-store'

type LibraryState = {
  collections: Collection[]
  selectedCollectionId: string | null
  selectedAudio: string | null
  lastAudioByCollection: Record<string, string>
  lastAudioPositions: Record<string, number>
  playCounts: Record<string, number>
  loading: boolean
  hydrated: boolean
  error: string | null
  trackMeta: Record<string, { artist: string; album: string; title: string } | null>
  trackDurations: Record<string, number | null>
  trackDatesAdded: Record<string, number | null>
  audioMarks: Record<string, AudioMark>
  orderedPaths: string[]
  setCollections: (collections: Collection[]) => void
  setLastAudioByCollection: (lastAudioByCollection: Record<string, string>) => void
  setLastAudioPositions: (positions: Record<string, number>) => void
  setPlayCounts: (playCounts: Record<string, number>) => void
  recordPlay: (path: string) => void
  saveAudioPosition: (path: string, positionMs: number) => void
  setOrderedPaths: (paths: string[]) => void
  setAudioMarks: (audioMarks: Record<string, AudioMark>) => void
  addCollection: (title: string) => string
  addCollectionWithItems: (title: string, items: string[], watchedFolders: string[]) => string
  reorderCollection: (sourceId: string, targetId: string, position: 'before' | 'after') => void
  updateCollectionTitle: (id: string, title: string) => void
  deleteCollection: (id: string) => void
  setTrackMeta: (
    path: string,
    meta: { artist: string; album: string; title: string } | null
  ) => void
  setTrackDuration: (path: string, duration: number | null) => void
  setBulkTrackInfo: (
    items: Record<
      string,
      { meta?: { artist: string; album: string; title: string }; duration?: number | null }
    >
  ) => void
  setBulkDatesAdded: (items: Record<string, number | null>) => void
  selectCollection: (id: string | null) => void
  addItemsToSelectedCollection: (paths: string[]) => void
  removeItemsFromSelectedCollection: (paths: string[]) => void
  addFoldersToSelectedCollection: (paths: string[]) => void
  selectAudio: (path: string | null) => void
  cycleAudioMark: (path: string) => void
  setLoading: (loading: boolean) => void
  setHydrated: (hydrated: boolean) => void
  setError: (err: string | null) => void
}

export const useLibrary = create<LibraryState>((set, get) => ({
  collections: [],
  selectedCollectionId: null,
  selectedAudio: null,
  lastAudioByCollection: {},
  lastAudioPositions: {},
  playCounts: {},
  loading: false,
  hydrated: false,
  error: null,
  trackMeta: {},
  trackDurations: {},
  trackDatesAdded: {},
  audioMarks: {},
  orderedPaths: [],
  setCollections: (collections) => set({ collections }),
  setLastAudioByCollection: (lastAudioByCollection) => set({ lastAudioByCollection }),
  setLastAudioPositions: (lastAudioPositions) => set({ lastAudioPositions }),
  setPlayCounts: (playCounts) => set({ playCounts }),
  recordPlay: (path) => {
    if (!path) return
    // Bump the list right away; main does the arithmetic that gets persisted
    // and broadcasts the authoritative count back to every window.
    const playCounts = get().playCounts
    set({ playCounts: { ...playCounts, [path]: (playCounts[path] ?? 0) + 1 } })
    void window.soundbox.incrementPlayCount(path)
  },
  saveAudioPosition: (path, positionMs) => {
    if (!path) return
    const rounded = Math.round(positionMs)
    const { lastAudioPositions } = get()
    if (lastAudioPositions[path] === rounded) return
    const next = { ...lastAudioPositions, [path]: rounded }
    set({ lastAudioPositions: next })
    void window.soundbox.setState({
      lastAudioPositionMs: rounded,
      lastAudioPositions: next
    })
  },
  setOrderedPaths: (orderedPaths) => set({ orderedPaths }),
  setAudioMarks: (audioMarks) => set({ audioMarks }),
  addCollection: (title) => {
    const id = Date.now().toString()
    const newCollection: Collection = { id, title, items: [] }
    const next = [...get().collections, newCollection]
    set({ collections: next, selectedCollectionId: id, selectedAudio: null })
    usePlayer.getState().setPlaying(false)
    void window.soundbox.setState({
      collections: next,
      selectedCollectionId: id,
      lastAudioPath: null
    })
    return id
  },
  addCollectionWithItems: (title, items, watchedFolders) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const firstAudio = items[0] ?? null
    const newCollection: Collection = { id, title, items, watchedFolders }
    const next = [...get().collections, newCollection]
    const nextLastAudioMap = firstAudio
      ? { ...get().lastAudioByCollection, [id]: firstAudio }
      : get().lastAudioByCollection
    set({
      collections: next,
      selectedCollectionId: id,
      selectedAudio: firstAudio,
      lastAudioByCollection: nextLastAudioMap
    })
    usePlayer.getState().setPlaying(false)
    void window.soundbox.setState({
      collections: next,
      selectedCollectionId: id,
      lastAudioPath: firstAudio,
      lastAudioByCollection: nextLastAudioMap
    })
    return id
  },
  reorderCollection: (sourceId, targetId, position) => {
    if (sourceId === targetId) return

    const { collections } = get()
    const source = collections.find((collection) => collection.id === sourceId)
    if (!source) return

    const reordered = collections.filter((collection) => collection.id !== sourceId)
    const targetIndex = reordered.findIndex((collection) => collection.id === targetId)
    if (targetIndex === -1) return

    const insertionIndex = targetIndex + (position === 'after' ? 1 : 0)
    reordered.splice(insertionIndex, 0, source)

    if (reordered.every((collection, index) => collection.id === collections[index]?.id)) return

    set({ collections: reordered })
    void window.soundbox.setState({ collections: reordered })
  },
  updateCollectionTitle: (id, title) => {
    const next = get().collections.map((c) => (c.id === id ? { ...c, title } : c))
    set({ collections: next })
    void window.soundbox.setState({ collections: next })
  },
  deleteCollection: (id) => {
    const { collections, selectedCollectionId, lastAudioByCollection } = get()
    const next = collections.filter((c) => c.id !== id)
    const nextLastAudioMap = { ...lastAudioByCollection }
    delete nextLastAudioMap[id]

    let nextSelectedId = selectedCollectionId
    let nextSelectedAudio = get().selectedAudio

    if (selectedCollectionId === id) {
      nextSelectedId = next.length > 0 ? next[0].id : null
      if (nextSelectedId) {
        const nextColl = next[0]
        const remembered = nextLastAudioMap[nextSelectedId]
        if (remembered && nextColl.items.includes(remembered)) {
          nextSelectedAudio = remembered
        } else {
          nextSelectedAudio = nextColl.items?.[0] || null
        }
      } else {
        nextSelectedAudio = null
      }
      usePlayer.getState().setPlaying(false)
    }

    set({
      collections: next,
      selectedCollectionId: nextSelectedId,
      selectedAudio: nextSelectedAudio,
      lastAudioByCollection: nextLastAudioMap
    })
    void window.soundbox.setState({
      collections: next,
      selectedCollectionId: nextSelectedId,
      lastAudioPath: nextSelectedAudio,
      lastAudioByCollection: nextLastAudioMap
    })
  },
  setTrackMeta: (path, meta) => set((s) => ({ trackMeta: { ...s.trackMeta, [path]: meta } })),
  setTrackDuration: (path, duration) =>
    set((s) => ({ trackDurations: { ...s.trackDurations, [path]: duration } })),
  setBulkTrackInfo: (items) =>
    set((s) => {
      const nextMeta = { ...s.trackMeta }
      const nextDurations = { ...s.trackDurations }
      for (const [path, info] of Object.entries(items)) {
        if (info.meta) nextMeta[path] = info.meta
        if ('duration' in info) nextDurations[path] = info.duration ?? null
      }
      return { trackMeta: nextMeta, trackDurations: nextDurations }
    }),
  setBulkDatesAdded: (items) =>
    set((s) => ({ trackDatesAdded: { ...s.trackDatesAdded, ...items } })),
  selectCollection: (id) => {
    const { collections, selectedCollectionId, trackMeta, lastAudioByCollection } = get()
    if (selectedCollectionId === id) return

    const collection = collections.find((c) => c.id === id)
    let targetAudio: string | null = null
    if (collection && collection.items.length > 0) {
      const remembered = id ? lastAudioByCollection[id] : null
      if (remembered && collection.items.includes(remembered)) {
        targetAudio = remembered
      } else {
        const sorted = [...collection.items].sort((a, b) => {
          const metaA = trackMeta[a]
          const metaB = trackMeta[b]
          const titleA = metaA?.title && metaA.title !== 'Unknown' ? metaA.title : basename(a)
          const titleB = metaB?.title && metaB.title !== 'Unknown' ? metaB.title : basename(b)
          return titleA.localeCompare(titleB, undefined, {
            numeric: true,
            sensitivity: 'base',
            usage: 'sort'
          })
        })
        targetAudio = sorted[0]
      }
    }

    const nextLastAudioMap =
      id && targetAudio ? { ...lastAudioByCollection, [id]: targetAudio } : lastAudioByCollection

    set({
      selectedCollectionId: id,
      selectedAudio: targetAudio,
      lastAudioByCollection: nextLastAudioMap
    })
    usePlayer.getState().setPlaying(false)
    void window.soundbox.setState({
      selectedCollectionId: id,
      lastAudioPath: targetAudio,
      lastAudioByCollection: nextLastAudioMap
    })
  },
  addItemsToSelectedCollection: (paths) => {
    const { collections, selectedCollectionId } = get()
    if (!selectedCollectionId) return
    const pathSet = new Set(paths)
    const next = collections.map((c) => {
      if (c.id === selectedCollectionId) {
        const items = Array.from(new Set([...c.items, ...paths]))
        const excludedPaths = (c.excludedPaths || []).filter((p) => !pathSet.has(p))
        return { ...c, items, excludedPaths }
      }
      return c
    })
    set({ collections: next })
    void window.soundbox.setState({ collections: next })
  },
  removeItemsFromSelectedCollection: (paths) => {
    const { collections, selectedCollectionId, selectedAudio, lastAudioByCollection } = get()
    if (!selectedCollectionId) return
    const pathSet = new Set(paths)

    let nextSelectedAudio = selectedAudio
    if (selectedAudio && pathSet.has(selectedAudio)) {
      nextSelectedAudio = null
      usePlayer.getState().setPlaying(false)
    }

    const nextLastAudioMap = { ...lastAudioByCollection }
    if (
      selectedCollectionId &&
      nextLastAudioMap[selectedCollectionId] &&
      pathSet.has(nextLastAudioMap[selectedCollectionId])
    ) {
      if (nextSelectedAudio) {
        nextLastAudioMap[selectedCollectionId] = nextSelectedAudio
      } else {
        delete nextLastAudioMap[selectedCollectionId]
      }
    }

    const next = collections.map((c) => {
      if (c.id === selectedCollectionId) {
        const items = c.items.filter((p) => !pathSet.has(p))
        const excludedPaths = Array.from(new Set([...(c.excludedPaths || []), ...paths]))
        return { ...c, items, excludedPaths }
      }
      return c
    })

    set({
      collections: next,
      selectedAudio: nextSelectedAudio,
      lastAudioByCollection: nextLastAudioMap
    })
    void window.soundbox.setState({
      collections: next,
      lastAudioPath: nextSelectedAudio,
      lastAudioByCollection: nextLastAudioMap
    })
  },
  addFoldersToSelectedCollection: (paths) => {
    const { collections, selectedCollectionId } = get()
    if (!selectedCollectionId) return
    const next = collections.map((c) => {
      if (c.id === selectedCollectionId) {
        const folders = new Set([...(c.watchedFolders || []), ...paths])
        return { ...c, watchedFolders: Array.from(folders) }
      }
      return c
    })
    set({ collections: next })
    void window.soundbox.setState({ collections: next })
  },
  selectAudio: (selectedAudio) => {
    const { selectedCollectionId, lastAudioByCollection } = get()
    if (selectedCollectionId && selectedAudio) {
      const nextMap = { ...lastAudioByCollection, [selectedCollectionId]: selectedAudio }
      set({ selectedAudio, lastAudioByCollection: nextMap })
      void window.soundbox.setState({
        lastAudioPath: selectedAudio,
        lastAudioByCollection: nextMap
      })
    } else {
      set({ selectedAudio })
      void window.soundbox.setState({ lastAudioPath: selectedAudio })
    }
  },
  cycleAudioMark: (path) => {
    const { audioMarks } = get()
    const next = { ...audioMarks }
    const mark = nextAudioMark(next[path] ?? null)
    if (mark === null) {
      delete next[path]
    } else {
      next[path] = mark
    }
    set({ audioMarks: next })
    void window.soundbox.setState({ audioMarks: next, likedPaths: {} })
  },
  setLoading: (loading) => set({ loading }),
  setHydrated: (hydrated) => set({ hydrated }),
  setError: (error) => set({ error })
}))
