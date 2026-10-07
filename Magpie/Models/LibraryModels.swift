import Foundation

nonisolated enum SidebarItem: Hashable, Codable, Sendable {
    case favorites
    case collection(UUID)
}

/// A named group of audio files. Folders are watched: rescanning picks up new
/// files inside them, minus anything the user removed explicitly.
nonisolated struct LibraryCollection: Identifiable, Hashable, Codable, Sendable {
    var id = UUID()
    var name: String
    var folders: [String] = []
    var items: [String] = []
    var addedAt: [String: Date] = [:]
    var excluded: Set<String> = []
}

nonisolated struct LibrarySnapshot: Codable, Sendable {
    var collections: [LibraryCollection] = []
    var selection: SidebarItem?
    var favorites: Set<String> = []
    var playCounts: [String: Int] = [:]
    var positions: [String: Double] = [:]
    var lastTrackPath: String?
}

nonisolated struct CachedTrack: Codable, Sendable {
    var track: Track
    var modified: Date
}

/// A song in Up Next. The same song can be queued more than once.
nonisolated struct QueueEntry: Identifiable, Hashable, Sendable {
    let id = UUID()
    let path: String
}

nonisolated enum RepeatMode: String, Codable, Sendable {
    case off, all, one

    var next: RepeatMode {
        switch self {
        case .off: .all
        case .all: .one
        case .one: .off
        }
    }

    var symbol: String { self == .one ? "repeat.1" : "repeat" }
}

enum DisplayMode: Hashable {
    case list, player

    var minimumSize: CGSize {
        self == .list ? CGSize(width: 900, height: 520) : CGSize(width: 360, height: 520)
    }
}

enum SortKey: String, CaseIterable, Identifiable {
    case order, title, artist, album, duration, plays, added

    var id: Self { self }

    var title: String {
        switch self {
        case .order: "Collection Order"
        case .title: "Title"
        case .artist: "Artist"
        case .album: "Album"
        case .duration: "Time"
        case .plays: "Plays"
        case .added: "Date Added"
        }
    }
}
