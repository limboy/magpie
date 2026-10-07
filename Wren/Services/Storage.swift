import Foundation

nonisolated enum Storage {
    static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        // Builds with another bundle ID (e.g. a dev copy) keep their own data.
        let bundleID = Bundle.main.bundleIdentifier ?? "com.limboy.wren"
        let name = bundleID == "com.limboy.wren" ? "Wren" : bundleID
        let url = base.appendingPathComponent(name, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    static func url(_ name: String) -> URL { directory.appendingPathComponent(name) }

    static func read<T: Decodable>(_ type: T.Type, from name: String) -> T? {
        guard let data = try? Data(contentsOf: url(name)) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func encode<T: Encodable>(_ value: T) -> Data? {
        try? JSONEncoder().encode(value)
    }

    static func write(_ data: Data, to name: String) {
        try? data.write(to: url(name), options: .atomic)
    }
}
