import Foundation

nonisolated enum AudioFiles {
    static let extensions: Set<String> = [
        "mp3", "m4a", "m4b", "aac", "alac", "flac", "wav", "aif", "aiff", "aifc", "caf", "mp4",
    ]

    static func isAudio(_ url: URL) -> Bool {
        extensions.contains(url.pathExtension.lowercased())
    }

    static func isDirectory(_ url: URL) -> Bool {
        var isDir: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) && isDir.boolValue
    }

    /// Every audio file under the given files and folders, in Finder order.
    @concurrent static func scan(_ urls: [URL]) async -> [String] {
        collect(urls)
    }

    private static func collect(_ urls: [URL]) -> [String] {
        var found: [String] = []
        for url in urls {
            if isDirectory(url) {
                let enumerator = FileManager.default.enumerator(
                    at: url,
                    includingPropertiesForKeys: [.isRegularFileKey],
                    options: [.skipsHiddenFiles, .skipsPackageDescendants]
                )
                while let file = enumerator?.nextObject() as? URL {
                    if isAudio(file) { found.append(file.path) }
                }
            } else if isAudio(url) {
                found.append(url.path)
            }
        }
        return found.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    static func modificationDate(_ path: String) -> Date? {
        (try? FileManager.default.attributesOfItem(atPath: path))?[.modificationDate] as? Date
    }

    @concurrent static func existing(_ paths: [String]) async -> Set<String> {
        Set(paths.filter { FileManager.default.fileExists(atPath: $0) })
    }
}
