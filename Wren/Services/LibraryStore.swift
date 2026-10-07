import AppKit
import Observation

@Observable
final class LibraryStore {
    var collections: [LibraryCollection] = [] {
        didSet {
            scheduleSave()
            watcher.watch(collections.flatMap(\.folders))
        }
    }
    var selection: SidebarItem? { didSet { scheduleSave() } }
    private(set) var favorites: Set<String> = [] { didSet { scheduleSave() } }
    private(set) var playCounts: [String: Int] = [:] { didSet { scheduleSave() } }
    private(set) var tracks: [String: Track] = [:]
    private(set) var isLoadingMetadata = false

    // Written often by the player and never displayed, so not observed.
    @ObservationIgnored var lastTrackPath: String? { didSet { scheduleSave() } }
    @ObservationIgnored private(set) var positions: [String: Double] = [:]

    @ObservationIgnored private var modified: [String: Date] = [:]
    @ObservationIgnored private var loading: Set<String> = []
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var metadataSaveTask: Task<Void, Never>?
    @ObservationIgnored private var isRestoring = false
    @ObservationIgnored private let watcher = FolderWatcher()
    @ObservationIgnored private var pendingChanges: Set<String> = []
    @ObservationIgnored private var changeTask: Task<Void, Never>?

    nonisolated private static let libraryFile = "library.json"
    nonisolated private static let metadataFile = "metadata.json"

    init() {
        isRestoring = true
        if let snapshot = Storage.read(LibrarySnapshot.self, from: Self.libraryFile) {
            collections = snapshot.collections
            selection = snapshot.selection
            favorites = snapshot.favorites
            playCounts = snapshot.playCounts
            positions = snapshot.positions
            lastTrackPath = snapshot.lastTrackPath
        }
        if let cache = Storage.read([String: CachedTrack].self, from: Self.metadataFile) {
            tracks = cache.mapValues(\.track)
            modified = cache.mapValues(\.modified)
        }
        if selection == nil, let first = collections.first { selection = .collection(first.id) }
        isRestoring = false

        watcher.onChange = { [weak self] paths in self?.foldersChanged(paths) }
        watcher.watch(collections.flatMap(\.folders))
        Task { await refresh() }
    }

    // MARK: Queries

    func track(for path: String) -> Track {
        tracks[path] ?? .placeholder(path: path)
    }

    func collection(_ id: UUID) -> LibraryCollection? {
        collections.first { $0.id == id }
    }

    func paths(for item: SidebarItem?) -> [String] {
        switch item {
        case .favorites:
            var seen = Set<String>()
            return collections.flatMap(\.items).filter { favorites.contains($0) && seen.insert($0).inserted }
        case .collection(let id):
            return collection(id)?.items ?? []
        case nil:
            return []
        }
    }

    func title(for item: SidebarItem?) -> String {
        switch item {
        case .favorites: "Favorites"
        case .collection(let id): collection(id)?.name ?? "Wren"
        case nil: "Wren"
        }
    }

    func addedDate(_ path: String, in item: SidebarItem?) -> Date? {
        if case .collection(let id) = item { return collection(id)?.addedAt[path] }
        return collections.lazy.compactMap { $0.addedAt[path] }.first
    }

    func isFavorite(_ path: String) -> Bool { favorites.contains(path) }
    func plays(_ path: String) -> Int { playCounts[path] ?? 0 }
    func position(_ path: String) -> Double? { positions[path] }

    // MARK: Mutations

    func toggleFavorite(_ path: String) {
        if favorites.contains(path) { favorites.remove(path) } else { favorites.insert(path) }
    }

    func recordPlay(_ path: String) {
        playCounts[path, default: 0] += 1
    }

    func setPosition(_ position: Double?, for path: String) {
        positions[path] = position
        scheduleSave()
    }

    /// Asks for folders and turns each into a new collection.
    func presentAddFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = true
        panel.prompt = "Add"
        panel.message = "Choose folders to add as collections"
        guard panel.runModal() == .OK else { return }
        let urls = panel.urls
        Task { await addCollections(from: urls) }
    }

    /// Turns each folder into a new collection, and any loose audio files into
    /// one more, named after their folder. A folder that's already a
    /// collection is just selected.
    func addCollections(from urls: [URL]) async {
        for folder in urls where AudioFiles.isDirectory(folder) {
            if let existing = collections.first(where: { $0.folders.contains(folder.path) }) {
                selection = .collection(existing.id)
                continue
            }
            let items = await AudioFiles.scan([folder])
            await addCollection(named: folder.lastPathComponent, folders: [folder.path], items: items)
        }
        let files = urls.filter { !AudioFiles.isDirectory($0) && AudioFiles.isAudio($0) }
        if let first = files.first {
            let items = await AudioFiles.scan(files)
            await addCollection(named: first.deletingLastPathComponent().lastPathComponent, folders: [], items: items)
        }
    }

    private func addCollection(named name: String, folders: [String], items: [String]) async {
        let now = Date()
        let collection = LibraryCollection(
            name: name,
            folders: folders,
            items: items,
            addedAt: Dictionary(items.map { ($0, now) }, uniquingKeysWith: { first, _ in first })
        )
        collections.append(collection)
        selection = .collection(collection.id)
        await loadMetadata(items)
    }

    /// Adds dropped files and folders to an existing collection.
    func add(_ urls: [URL], to id: UUID) async {
        let items = await AudioFiles.scan(urls)
        guard let index = collections.firstIndex(where: { $0.id == id }) else { return }
        var collection = collections[index]
        for url in urls where AudioFiles.isDirectory(url) && !collection.folders.contains(url.path) {
            collection.folders.append(url.path)
        }
        let existing = Set(collection.items)
        let now = Date()
        for path in items where !existing.contains(path) {
            collection.items.append(path)
            collection.addedAt[path] = now
            collection.excluded.remove(path)
        }
        collections[index] = collection
        await loadMetadata(items)
    }

    func remove(_ paths: Set<String>, from id: UUID) {
        guard let index = collections.firstIndex(where: { $0.id == id }) else { return }
        collections[index].items.removeAll { paths.contains($0) }
        collections[index].excluded.formUnion(paths)
        for path in paths { collections[index].addedAt[path] = nil }
    }

    func rename(_ id: UUID, to name: String) {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let index = collections.firstIndex(where: { $0.id == id }) else { return }
        collections[index].name = name
    }

    func deleteCollection(_ id: UUID) {
        collections.removeAll { $0.id == id }
        if selection == .collection(id) {
            selection = collections.first.map { .collection($0.id) }
        }
    }

    /// Collects FSEvents for a moment, then rescans only the collections they touch.
    private func foldersChanged(_ paths: [String]) {
        // Ignore noise like .DS_Store or lyric files; directories (no extension) can be renames.
        let relevant = paths.filter { path in
            let ext = (path as NSString).pathExtension.lowercased()
            return ext.isEmpty || AudioFiles.extensions.contains(ext)
        }
        guard !relevant.isEmpty else { return }
        pendingChanges.formUnion(relevant)
        changeTask?.cancel()
        changeTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            let changed = pendingChanges
            pendingChanges.removeAll()
            let affected = collections.filter { collection in
                collection.folders.contains { folder in
                    changed.contains { $0 == folder || $0.hasPrefix(folder + "/") }
                }
            }
            guard !affected.isEmpty else { return }
            await refresh(Set(affected.map(\.id)))
        }
    }

    /// Rescans collections' folders (all of them by default): new files are
    /// appended, files that disappeared from disk are dropped, and edited files
    /// have their metadata re-read.
    func refresh(_ ids: Set<UUID>? = nil) async {
        let targets = collections.filter { ids?.contains($0.id) ?? true }
        for collection in targets {
            let scanned = await AudioFiles.scan(collection.folders.map { URL(fileURLWithPath: $0) })
            let alive = await AudioFiles.existing(collection.items)
            guard let index = collections.firstIndex(where: { $0.id == collection.id }) else { continue }
            var updated = collections[index]
            let known = Set(updated.items)
            let now = Date()
            updated.items.removeAll { !alive.contains($0) && !scanned.contains($0) }
            for path in scanned where !known.contains(path) && !updated.excluded.contains(path) {
                updated.items.append(path)
                updated.addedAt[path] = now
            }
            if updated != collections[index] { collections[index] = updated }
        }
        await loadMetadata(collections.filter { ids?.contains($0.id) ?? true }.flatMap(\.items))
    }

    func revealInFinder(_ paths: [String]) {
        NSWorkspace.shared.activateFileViewerSelecting(paths.map { URL(fileURLWithPath: $0) })
    }

    // MARK: Metadata

    func loadMetadata(_ paths: [String]) async {
        let candidates = Array(Set(paths).subtracting(loading))
        let stale = await MetadataReader.stale(candidates, known: modified)
        guard !stale.isEmpty else { return }
        loading.formUnion(stale)
        isLoadingMetadata = true
        defer {
            loading.subtract(stale)
            isLoadingMetadata = !loading.isEmpty
            scheduleMetadataSave()
        }

        // Files we'd read before have changed on disk; their artwork may have too.
        ArtworkCache.shared.invalidate(stale.filter { modified[$0] != nil })
        await withTaskGroup(of: CachedTrack.self) { group in
            var pending = stale.makeIterator()
            for _ in 0..<8 {
                guard let path = pending.next() else { break }
                group.addTask { await MetadataReader.read(path: path) }
            }
            var batch: [CachedTrack] = []
            for await result in group {
                batch.append(result)
                if let path = pending.next() {
                    group.addTask { await MetadataReader.read(path: path) }
                }
                if batch.count >= 50 {
                    apply(batch)
                    batch.removeAll()
                }
            }
            apply(batch)
        }
    }

    private func apply(_ batch: [CachedTrack]) {
        guard !batch.isEmpty else { return }
        var updated = tracks
        for entry in batch {
            updated[entry.track.path] = entry.track
            modified[entry.track.path] = entry.modified
        }
        tracks = updated
    }

    // MARK: Persistence

    private var snapshot: LibrarySnapshot {
        LibrarySnapshot(
            collections: collections, selection: selection, favorites: favorites,
            playCounts: playCounts, positions: positions, lastTrackPath: lastTrackPath
        )
    }

    private func scheduleSave() {
        guard !isRestoring else { return }
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled, let data = Storage.encode(snapshot) else { return }
            Task.detached(priority: .utility) { Storage.write(data, to: Self.libraryFile) }
        }
    }

    private func scheduleMetadataSave() {
        metadataSaveTask?.cancel()
        metadataSaveTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            let cache = tracks.reduce(into: [String: CachedTrack]()) { result, entry in
                if let date = modified[entry.key] { result[entry.key] = CachedTrack(track: entry.value, modified: date) }
            }
            guard let data = Storage.encode(cache) else { return }
            Task.detached(priority: .utility) { Storage.write(data, to: Self.metadataFile) }
        }
    }

    /// Writes immediately; used when the app is about to quit.
    func saveNow() {
        saveTask?.cancel()
        if let data = Storage.encode(snapshot) { Storage.write(data, to: Self.libraryFile) }
    }
}
