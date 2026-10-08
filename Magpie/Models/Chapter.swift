import Foundation

nonisolated struct Chapter: Identifiable, Hashable, Codable, Sendable {
    let id: Int
    let title: String
    let start: TimeInterval
    let end: TimeInterval

    var duration: TimeInterval { end - start }

    /// Sort, deduplicate and clamp metadata before exposing it to the player.
    static func normalized(_ chapters: [Chapter], duration: TimeInterval) -> [Chapter] {
        guard duration.isFinite, duration > 0 else { return [] }
        let sorted = chapters.filter { $0.start.isFinite && $0.start >= 0 && $0.start < duration }
            .sorted { $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start }
        var unique: [Chapter] = []
        for chapter in sorted where unique.last?.start != chapter.start { unique.append(chapter) }
        return unique.enumerated().map { index, chapter in
            let limit = index + 1 < unique.count ? unique[index + 1].start : duration
            let end = chapter.end.isFinite && chapter.end > chapter.start ? min(chapter.end, limit) : limit
            let title = chapter.title.trimmingCharacters(in: .whitespacesAndNewlines)
            return Chapter(id: index, title: title.isEmpty ? "Chapter \(index + 1)" : title, start: chapter.start, end: end)
        }
    }

    static func index(at time: TimeInterval, in chapters: [Chapter]) -> Int? {
        chapters.lastIndex { time >= $0.start && time < $0.end }
    }
}

/// A book's chapters play as tracks of their own, identified by the book's
/// path plus the chapter number: `/Books/Dune.m4b#3`. Everything that keys
/// off a path (the queue, Up Next, the song list) takes these as is; what
/// belongs to the whole book (favorites, play counts, the resume position)
/// is kept under the file's path.
nonisolated enum ChapterID {
    static func make(_ file: String, _ index: Int) -> String { "\(file)#\(index + 1)" }

    static func parse(_ id: String) -> (file: String, index: Int)? {
        guard let hash = id.lastIndex(of: "#") else { return nil }
        let file = String(id[..<hash])
        // A real file's extension never ends in "#n", so this can't misread a path.
        guard AudioFiles.mayHaveChapters(file), let number = Int(id[id.index(after: hash)...]), number > 0
        else { return nil }
        return (file, number - 1)
    }

    /// The file a track plays from: the book for a chapter, else the path itself.
    static func file(_ id: String) -> String { parse(id)?.file ?? id }
}
