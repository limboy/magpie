import SwiftUI

nonisolated struct TrackRow: Identifiable, Hashable {
    let track: Track
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
        let item = library.selection
        let query = ui.searchText.trimmingCharacters(in: .whitespaces)
        let rows = library.paths(for: item).enumerated().compactMap { index, path -> TrackRow? in
            if ui.onlyFavorites && !library.isFavorite(path) { return nil }
            let track = library.track(for: path)
            if !query.isEmpty,
               !(track.title.localizedStandardContains(query) || track.artist.localizedStandardContains(query)
                   || track.album.localizedStandardContains(query)) {
                return nil
            }
            return TrackRow(
                track: track, plays: library.plays(path), isFavorite: library.isFavorite(path),
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
            if case .collection(let id) = library.selection {
                Task { await library.add(urls, to: id) }
            } else {
                Task { await library.addCollections(from: urls) }
            }
            return true
        }
        .onChange(of: library.selection) { selection.removeAll() }
        // The collection name over the song count, in the toolbar row. A custom
        // item rather than navigationTitle, so it can be larger and line up
        // with the list.
        .toolbar {
            if ui.settledMode == .list {
            ToolbarItem(placement: .navigation) {
                SidebarToggle()
            }
            ToolbarItem(placement: .navigation) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(library.collections.isEmpty ? "Magpie" : library.title(for: library.selection))
                        .font(.system(size: 17, weight: .bold))
                    if !library.collections.isEmpty {
                        Text(summary(rows))
                            .font(.system(size: 11))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                            .contentTransition(.numericText())
                    }
                }
                .lineLimit(1)
            }
            .sharedBackgroundVisibility(.hidden)
            }
            ListModeToolbar(mode: ui.settledMode)
        }
        .toolbar(removing: .title)
        // The player covers this view rather than replacing it, so the toolbar
        // stays put (and the content under it never moves); it just turns
        // transparent and trades its items for the player's.
        .toolbarBackgroundVisibility(ui.settledMode == .list ? .automatic : .hidden, for: .windowToolbar)
    }

    // MARK: Summary

    /// The floating player's height plus the gap below it; the list scrolls
    /// its last rows clear of it.
    private static let playerMargin: CGFloat = 16
    static let playerClearance: CGFloat = 54 + playerMargin + 12

    private func summary(_ rows: [TrackRow]) -> String {
        func songs(_ count: Int) -> String { "\(count) \(count == 1 ? "song" : "songs")" }
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
            onPlay: { player.play($0, in: ids) },
            onToggleFavorite: { library.toggleFavorite($0) },
            menu: { menuEntries($0, ids: ids) }
        )
    }

    private func menuEntries(_ selected: Set<String>, ids: [String]) -> [TrackMenuEntry] {
        guard let first = ids.first(where: selected.contains) else { return [] }
        let allFavorite = selected.allSatisfy(library.isFavorite)
        var entries: [TrackMenuEntry] = [
            .item("Play") { player.play(first, in: ids) },
            .separator,
            .item(allFavorite ? "Unfavorite" : "Favorite") {
                for id in selected where library.isFavorite(id) == allFavorite { library.toggleFavorite(id) }
            },
            .item("Show in Finder") { library.revealInFinder(Array(selected)) },
        ]
        if case .collection(let collectionID) = library.selection {
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
        } else if library.selection == .favorites {
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
