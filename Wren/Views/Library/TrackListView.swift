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

    private static let sortKeyPaths: [(SortKey, PartialKeyPath<TrackRow>)] = [
        (.order, \TrackRow.order), (.title, \TrackRow.title), (.artist, \TrackRow.artist),
        (.album, \TrackRow.album), (.duration, \TrackRow.duration), (.plays, \TrackRow.plays),
        (.added, \TrackRow.added),
    ]

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

    /// The table's column headers and the toolbar menu share one sort setting.
    private var sortOrder: Binding<[KeyPathComparator<TrackRow>]> {
        Binding {
            [Self.comparator(ui.sortKey, ascending: ui.sortAscending)]
        } set: { comparators in
            guard let first = comparators.first,
                  let key = Self.sortKeyPaths.first(where: { $0.1 == first.keyPath })?.0 else { return }
            ui.sortKey = key
            ui.sortAscending = first.order == .forward
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
        return rows.sorted(using: sortOrder.wrappedValue)
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
                Divider()
                statusBar(rows)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(.background)
        .dropDestination(for: URL.self) { urls, _ in
            if case .collection(let id) = library.selection {
                Task { await library.add(urls, to: id) }
            } else {
                Task { await library.addCollections(from: urls) }
            }
            return true
        }
        .onChange(of: library.selection) { selection.removeAll() }
    }

    // MARK: Status bar

    private func statusBar(_ rows: [TrackRow]) -> some View {
        Text(summary(rows))
            .font(.system(size: 11))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .frame(height: 36)
            .contentTransition(.numericText())
    }

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
        Table(rows, selection: $selection, sortOrder: sortOrder) {
            TableColumn("#", value: \.order) { row in
                NowPlayingIndicator(
                    order: row.order + 1, isCurrent: row.id == player.currentPath, isPlaying: player.isPlaying
                )
            }
            .width(32)

            TableColumn("Title", value: \.title) { row in
                Text(row.title)
                    .fontWeight(row.id == player.currentPath ? .semibold : .regular)
                    .foregroundStyle(row.id == player.currentPath ? Color.accentColor : .primary)
            }
            .width(min: 160, ideal: 280)

            TableColumn("Artist", value: \.artist) { row in
                Text(row.artist).foregroundStyle(.secondary)
            }
            .width(min: 100, ideal: 180)

            TableColumn("Album", value: \.album) { row in
                Text(row.album).foregroundStyle(.secondary)
            }
            .width(min: 100, ideal: 180)

            TableColumn("Plays", value: \.plays) { row in
                Text(row.plays > 0 ? "\(row.plays)" : "")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .width(48)

            TableColumn("Time", value: \.duration) { row in
                Text(row.duration > 0 ? formatTime(row.duration) : "")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .width(56)

            TableColumn(Text(Image(systemName: "star"))) { row in
                Button {
                    library.toggleFavorite(row.id)
                } label: {
                    Image(systemName: row.isFavorite ? "star.fill" : "star")
                        .foregroundStyle(row.isFavorite ? Color.accentColor : Color.secondary.opacity(0.5))
                }
                .buttonStyle(.plain)
                .help(row.isFavorite ? "Unfavorite" : "Favorite")
            }
            .width(28)
        }
        .tableStyle(.inset)
        .alternatingRowBackgrounds(.enabled)
        .contextMenu(forSelectionType: String.self) { ids in
            contextMenu(ids, rows: rows)
        } primaryAction: { ids in
            if let id = rows.first(where: { ids.contains($0.id) })?.id {
                player.play(id, in: rows.map(\.id))
            }
        }
    }

    @ViewBuilder
    private func contextMenu(_ ids: Set<String>, rows: [TrackRow]) -> some View {
        if let first = rows.first(where: { ids.contains($0.id) }) {
            Button("Play") { player.play(first.id, in: rows.map(\.id)) }
            Divider()
            let allFavorite = ids.allSatisfy(library.isFavorite)
            Button(allFavorite ? "Unfavorite" : "Favorite") {
                for id in ids where library.isFavorite(id) == allFavorite { library.toggleFavorite(id) }
            }
            Button("Show in Finder") { library.revealInFinder(Array(ids)) }
            if case .collection(let collectionID) = library.selection {
                Divider()
                Button("Remove from Collection", role: .destructive) {
                    library.remove(ids, from: collectionID)
                }
            }
        }
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

/// Table cells get plain values rather than reading the environment: SwiftUI
/// can re-render a cell that's being removed without its environment.
private struct NowPlayingIndicator: View {
    let order: Int
    let isCurrent: Bool
    let isPlaying: Bool

    var body: some View {
        Group {
            if isCurrent {
                Image(systemName: "speaker.wave.2.fill")
                    .symbolEffect(.variableColor.iterative.dimInactiveLayers, isActive: isPlaying)
                    .foregroundStyle(Color.accentColor)
            } else {
                Text("\(order)")
                    .monospacedDigit()
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}
