import Foundation

nonisolated struct Track: Identifiable, Hashable, Codable, Sendable {
    let path: String
    var title: String
    var artist: String
    var album: String
    var duration: TimeInterval

    var id: String { path }
    var url: URL { URL(fileURLWithPath: path) }

    /// A stand-in used until the file's metadata has been read.
    static func placeholder(path: String) -> Track {
        let name = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
        return Track(path: path, title: name, artist: "", album: "", duration: 0)
    }

    /// "Artist — Album", skipping whatever is missing.
    var subtitle: String {
        [artist, album].filter { !$0.isEmpty }.joined(separator: " — ")
    }
}
