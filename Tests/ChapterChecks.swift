import Foundation

@main struct ChapterChecks {
    static func main() async {
        let raw = [
            Chapter(id: 2, title: " ", start: 10, end: .nan),
            Chapter(id: 0, title: "Opening", start: 0, end: 20),
            Chapter(id: 1, title: "Duplicate", start: 0, end: 5),
            Chapter(id: 3, title: "Invalid", start: -.infinity, end: 1),
            Chapter(id: 4, title: "Outside", start: 30, end: 40),
        ]
        let chapters = Chapter.normalized(raw, duration: 30)
        precondition(chapters.count == 2)
        precondition(chapters[0].end == 10)
        precondition(chapters[1].title == "Chapter 2" && chapters[1].end == 30)
        precondition(Chapter.index(at: 0, in: chapters) == 0)
        precondition(Chapter.index(at: 9.999, in: chapters) == 0)
        precondition(Chapter.index(at: 10, in: chapters) == 1)
        precondition(Chapter.index(at: 30, in: chapters) == nil)
        precondition(Chapter.normalized(raw, duration: .nan).isEmpty)
        let gap = [Chapter(id: 0, title: "Late start", start: 5, end: 10)]
        precondition(Chapter.index(at: 0, in: gap) == nil)
        precondition(ChapterID.make("/a/Book.m4b", 2) == "/a/Book.m4b#3")
        precondition(ChapterID.parse("/a/Book.m4b#3").map { $0.file == "/a/Book.m4b" && $0.index == 2 } == true)
        precondition(ChapterID.parse("/a/Song #3.mp3") == nil)
        precondition(ChapterID.parse("/a/Book.m4b") == nil && ChapterID.parse("/a/Book.m4b#0") == nil)
        precondition(ChapterID.file("/a/Book #2.m4b#1") == "/a/Book #2.m4b")
        if CommandLine.arguments.count > 1 {
            let loaded = await ChapterReader.read(CommandLine.arguments[1])
            precondition(loaded.count == 3, "Expected three fixture chapters, got \(loaded)")
            precondition(loaded.map(\.title) == ["Opening", "Across the Valley", "Home"])
            precondition(abs(loaded[1].start - 2) < 0.01)
            if CommandLine.arguments.count > 2 {
                let plain = await ChapterReader.read(CommandLine.arguments[2])
                precondition(plain.isEmpty)
            }
            print("AVFoundation fixture reading and empty-file checks passed")
        }
        print("Chapter normalization and boundary checks passed")
    }
}
