import Foundation

nonisolated struct Track: Identifiable, Hashable, Codable, Sendable {
    let path: String
    var title: String
    var artist: String
    var album: String
    var duration: TimeInterval
    /// A book's chapters; empty when it has none, nil when not read yet
    /// (an older cache entry or a failed read).
    var chapters: [Chapter]?

    var id: String { path }
    var url: URL { URL(fileURLWithPath: ChapterID.file(path)) }
    var isBook: Bool { !(chapters ?? []).isEmpty }

    /// Failed reads, including older cached placeholders, must be retried even
    /// when the file's modification date hasn't changed (for example, iCloud downloads).
    var hasLoadedMetadata: Bool { duration.isFinite && duration > 0 && chapters != nil }

    /// A stand-in used until the file's metadata has been read.
    static func placeholder(path: String) -> Track {
        let name = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
        return Track(path: path, title: name, artist: "", album: "", duration: 0, chapters: nil)
    }

    /// One of a book's chapters, as a track: the book is its album.
    func chapterTrack(_ index: Int) -> Track? {
        guard let chapter = chapters?[safe: index] else { return nil }
        return Track(
            path: ChapterID.make(path, index), title: chapter.title, artist: artist,
            album: title, duration: chapter.duration, chapters: []
        )
    }

    /// "Artist — Album", skipping whatever is missing.
    var subtitle: String {
        [artist, album].filter { !$0.isEmpty }.joined(separator: " — ")
    }
}

extension Array {
    nonisolated subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
