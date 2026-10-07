import Foundation

nonisolated enum Storage {
    static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        // Named by bundle ID, so a dev copy keeps its own data, and so it
        // never meets the Electron Magpie's "magpie" folder (names here
        // ignore case).
        let url = base.appendingPathComponent(bundleID, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    private static let bundleID = Bundle.main.bundleIdentifier ?? "com.limboy.magpie"

    /// The app was called Wren. On first launch as Magpie, copy its library
    /// and settings over; the originals stay where they were.
    static func migrateFromWren() {
        let defaults = UserDefaults.standard
        let flag = "migratedFromWren"
        guard !defaults.bool(forKey: flag) else { return }
        defaults.set(true, forKey: flag)

        let isDev = bundleID.hasSuffix(".dev")
        let oldID = isDev ? "com.limboy.wren.dev" : "com.limboy.wren"
        if let old = UserDefaults(suiteName: oldID)?.persistentDomain(forName: oldID) {
            for (key, value) in old where defaults.object(forKey: key) == nil {
                defaults.set(value, forKey: key)
            }
        }

        let fileManager = FileManager.default
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let oldDirectory = base.appendingPathComponent(isDev ? oldID : "Wren", isDirectory: true)
        let newDirectory = base.appendingPathComponent(bundleID, isDirectory: true)
        guard fileManager.fileExists(atPath: oldDirectory.path),
              !fileManager.fileExists(atPath: newDirectory.appendingPathComponent("library.json").path)
        else { return }
        try? fileManager.removeItem(at: newDirectory)
        try? fileManager.copyItem(at: oldDirectory, to: newDirectory)
    }

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
