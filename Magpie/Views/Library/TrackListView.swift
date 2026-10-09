import SwiftUI

nonisolated struct TrackRow: Identifiable, Hashable {
    enum Kind { case song, book, chapter }

    let track: Track
    var kind: Kind = .song
    let plays: Int
    let isFavorite: Bool
    let added: Date
    let order: Int

    var id: String { track.path }
    var title: String { track.title }
    var artist: String { track.artist }
    var album: String { track.album }
    var duration: TimeInterval { track.duration }
}

struct TrackListView: View {
    @Environment(LibraryStore.self) private var library
    @Environment(PlayerEngine.self) private var player
    @Environment(AppState.self) private var ui

    @State private var selection = Set<String>()

    private static func comparator(_ key: SortKey, ascending: Bool) -> KeyPathComparator<TrackRow> {
        let order: SortOrder = ascending ? .forward : .reverse
        return switch key {
        case .order: KeyPathComparator(\.order, order: order)
        case .title: KeyPathComparator(\.title, order: order)
        case .artist: KeyPathComparator(\.artist, order: order)
        case .album: KeyPathComparator(\.album, order: order)
        case .duration: KeyPathComparator(\.duration, order: order)
        case .plays: KeyPathComparator(\.plays, order: order)
        case .added: KeyPathComparator(\.added, order: order)
        }
    }

    private var rows: [TrackRow] {
        let item = library.listSelection
        let query = ui.searchText.trimmingCharacters(in: .whitespaces)
        if let book = ui.openBook {
            // Every chapter shares the book's artist and album, so "All"
            // looks only at chapter titles.
            let scope = ui.searchScope == .all ? .title : ui.searchScope
            let rows = library.chapterIDs(book).enumerated().compactMap { index, id -> TrackRow? in
                if ui.onlyFavorites && !library.isFavorite(id) { return nil }
                let chapter = library.track(for: id)
                if !query.isEmpty, !scope.matches(chapter, query) { return nil }
                return TrackRow(
                    track: chapter, kind: .chapter, plays: 0, isFavorite: library.isFavorite(id),
                    added: .distantPast, order: index
                )
            }
            return rows.sorted(using: Self.comparator(ui.sortKey, ascending: ui.sortAscending))
        }
        let rows = library.paths(for: item).enumerated().compactMap { index, path -> TrackRow? in
            if ui.onlyFavorites && !library.hasFavorite(path) { return nil }
            let track = library.track(for: path)
            if !query.isEmpty, !ui.searchScope.matches(track, query) { return nil }
            let kind: TrackRow.Kind = track.isBook ? .book : ChapterID.parse(path) != nil ? .chapter : .song
            return TrackRow(
                track: track, kind: kind, plays: library.plays(path), isFavorite: library.isFavorite(path),
                added: library.addedDate(path, in: item) ?? .distantPast, order: index
            )
        }
        return rows.sorted(using: Self.comparator(ui.sortKey, ascending: ui.sortAscending))
    }

    var body: some View {
        let rows = self.rows
        VStack(spacing: 0) {
            if library.collections.isEmpty {
                emptyLibrary
            } else {
                if rows.isEmpty {
                    emptyList
                        .frame(maxHeight: .infinity)
                } else {
                    table(rows)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(.background)
        .overlay(alignment: .bottom) {
            if !library.collections.isEmpty {
                NowPlayingLCD()
                    .padding(.horizontal, 20)
                    .padding(.bottom, Self.playerMargin)
            }
        }
        .dropDestination(for: URL.self) { urls, _ in
            if case .collection(let id) = library.listSelection {
                Task { await library.add(urls, to: id) }
            } else {
                Task { await library.addCollections(from: urls) }
            }
            return true
        }
        .onChange(of: library.listSelection) {
            selection.removeAll()
            ui.openBook = nil
        }
        // Next, Previous and the queue moving on take the selection along.
        .onChange(of: player.currentPath) { _, current in
            if let current, rows.contains(where: { $0.id == current }) { selection = [current] }
        }
        .onChange(of: ui.openBook) { old, _ in
            // Back out with the book still selected.
            selection = old.map { [$0] } ?? []
        }
        // Shown under the collection name in the toolbar.
        .onChange(of: summary(rows), initial: true) { ui.listSummary = $1 }
    }

    // MARK: Summary

    /// The floating player's height plus the gap below it; the list scrolls
    /// its last rows clear of it.
    private static let playerMargin: CGFloat = 16
    static let playerClearance: CGFloat = 54 + playerMargin + 12

    private func summary(_ rows: [TrackRow]) -> String {
        let noun = ui.openBook == nil ? "song" : "chapter"
        func songs(_ count: Int) -> String { "\(count) \(noun)\(count == 1 ? "" : "s")" }
        let selected = rows.filter { selection.contains($0.id) }
        if selected.count > 1 {
            let time = formatDuration(selected.reduce(0) { $0 + $1.duration })
            return "\(selected.count) of \(songs(rows.count)) selected, \(time)"
        }
        return "\(songs(rows.count)), \(formatDuration(rows.reduce(0) { $0 + $1.duration }))"
    }

    // MARK: Table

    private func table(_ rows: [TrackRow]) -> some View {
        let ids = rows.map(\.id)
        return TrackTable(
            rows: rows,
            bottomInset: Self.playerClearance,
            currentPath: player.currentPath,
            isPlaying: player.isPlaying,
            selection: $selection,
            sortKey: ui.sortKey,
            sortAscending: ui.sortAscending,
            onSort: { key, ascending in
                ui.sortKey = key
                ui.sortAscending = ascending
            },
            onPlay: { open($0, ids: ids) },
            onToggleFavorite: { library.toggleFavorite($0) },
            menu: { menuEntries($0, ids: ids) }
        )
    }

    /// Double-click or Return: a book opens like a folder; anything else plays,
    /// with the list's other songs (not its books) as the queue.
    private func open(_ id: String, ids: [String]) {
        // A starred chapter in Favorites plays rather than opening its book.
        if ui.openBook == nil, ChapterID.parse(id) == nil, library.book(id) != nil {
            ui.openBook = id
        } else {
            player.play(id, in: ids)
        }
    }

    private func menuEntries(_ selected: Set<String>, ids: [String]) -> [TrackMenuEntry] {
        guard let first = ids.first(where: selected.contains) else { return [] }
        let allFavorite = selected.allSatisfy(library.isFavorite)
        // Books are folders: they open, and never go in the queue themselves.
        let ordered = library.playable(ids.filter(selected.contains))
        let inBook = ui.openBook != nil
        var entries: [TrackMenuEntry] = []
        if !inBook, selected.count == 1, ChapterID.parse(first) == nil, library.book(first) != nil {
            entries += [.item("Open") { ui.openBook = first }, .separator]
        }
        if let firstSong = ordered.first {
            entries += [
                .item("Play") { player.play(firstSong, in: ids) },
                .item("Play Next") { player.playNext(ordered) },
                .item("Add to Queue") { player.addToQueue(ordered) },
                .separator,
            ]
        }
        entries += [.item(allFavorite ? "Unfavorite" : "Favorite") {
            for id in selected where library.isFavorite(id) == allFavorite { library.toggleFavorite(id) }
        }]
        entries += [.item("Show in Finder") { library.revealInFinder(Array(selected)) }]
        if !inBook, case .collection(let collectionID) = library.listSelection {
            entries += [.separator, .item("Remove from Collection") { library.remove(selected, from: collectionID) }]
        }
        return entries
    }

    // MARK: Empty states

    private var emptyLibrary: some View {
        ContentUnavailableView {
            Label("No Music Yet", systemImage: "music.note.list")
        } description: {
            Text("Add a folder of audio files, or drop one here.")
        } actions: {
            Button("Add Folder…") { library.presentAddFolder() }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
        }
    }

    @ViewBuilder
    private var emptyList: some View {
        if !ui.searchText.isEmpty {
            ContentUnavailableView.search(text: ui.searchText)
        } else if ui.onlyFavorites {
            ContentUnavailableView {
                Label("No Favorites Here", systemImage: "star")
            } description: {
                Text("Star songs in this collection, or show all songs.")
            } actions: {
                Button("Show All Songs") { ui.onlyFavorites = false }
            }
        } else if library.listSelection == .favorites {
            ContentUnavailableView(
                "No Favorites", systemImage: "star",
                description: Text("Star songs to collect them here.")
            )
        } else {
            ContentUnavailableView(
                "Empty Collection", systemImage: "folder",
                description: Text("Drop audio files or folders here to add them.")
            )
        }
    }
}
