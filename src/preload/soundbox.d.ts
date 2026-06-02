export type TreeNode =
  | { kind: 'dir'; name: string; path: string; children: TreeNode[] }
  | { kind: 'audio'; name: string; path: string }

export type Collection = {
  id: string
  title: string
  items: string[]
  watchedFolders?: string[]
  excludedPaths?: string[]
}

export type AppState = {
  collections: Collection[]
  selectedCollectionId: string | null
  lastAudioPath: string | null
  likedPaths?: Record<string, number>
}

export type LibraryChangedPayload = { kind: 'tree'; path: string }

export type UpdateInfo = { version: string }

export interface SoundboxApi {
  openFolder(): Promise<string | null>
  readTree(root: string): Promise<TreeNode>
  probeDuration(path: string): Promise<number | null>
  probeMetadata(path: string): Promise<{ artist: string; album: string; title: string } | null>
  getBulkMetadata(paths: string[]): Promise<Record<string, { meta: { artist: string; album: string; title: string }; duration: number | null }>>
  getCoverArt(path: string): Promise<string | null>
  getState(): Promise<AppState>
  setState(patch: Partial<AppState>): Promise<AppState>
  onLibraryChanged(cb: (payload: LibraryChangedPayload) => void): () => void
  onStateUpdated(cb: (state: AppState) => void): () => void
  getPathInfo(path: string): Promise<{ isDirectory: boolean; isFile: boolean; ext: string } | null>
  onPlaySong(cb: (path: string) => void): () => void
  revealInFinder(path: string): Promise<void>
  showSongContextMenu(path: string): Promise<void>
  showCollectionContextMenu(id: string, title: string): Promise<void>
  onRenameCollection(cb: (id: string, title: string) => void): () => void
  onDeleteCollection(cb: (id: string, title: string) => void): () => void
  getPathForFile(file: File): string
  update: {
    onUpdateReady(cb: (info: UpdateInfo) => void): () => void
    apply(): Promise<void>
  }
}

