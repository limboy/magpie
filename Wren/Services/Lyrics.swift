import CryptoKit
import Foundation

nonisolated struct LyricLine: Identifiable, Hashable, Sendable {
    let id: Int
    let time: TimeInterval
    let text: String
}

nonisolated enum Lyrics: Equatable, Sendable {
    case synced([LyricLine])
    case plain(String)
    case none
}

/// Finds lyrics for a track: a sidecar `.lrc` next to the file first, then
/// LRCLIB (https://lrclib.net). Results — including "not found" — are cached
/// on disk, keyed by the metadata used to look them up.
nonisolated enum LyricsService {
    private struct Record: Codable {
        var syncedLyrics: String?
        var plainLyrics: String?
        var duration: Double?
    }

    private static let userAgent = "Wren (https://github.com/limboy/wren)"

    private static let cacheDirectory: URL = {
        let url = Storage.directory.appendingPathComponent("lyrics", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    @concurrent static func lyrics(for track: Track) async -> Lyrics {
        let sidecar = track.url.deletingPathExtension().appendingPathExtension("lrc")
        if let data = try? Data(contentsOf: sidecar), let text = decode(data) {
            // Timed lines play in sync; an .lrc without timestamps shows as plain text.
            return parse(Record(syncedLyrics: text, plainLyrics: plainLRC(text)))
        }

        let cacheURL = cacheDirectory.appendingPathComponent(signature(track) + ".json")
        if let data = try? Data(contentsOf: cacheURL),
           let record = try? JSONDecoder().decode(Record.self, from: data) {
            return parse(record)
        }

        // A nil record means the network failed; don't cache that, so it retries.
        guard let record = await fetch(track) else { return .none }
        if let data = try? JSONEncoder().encode(record) {
            try? data.write(to: cacheURL, options: .atomic)
        }
        return parse(record)
    }

    private static func signature(_ track: Track) -> String {
        let key = "\(track.path)|\(track.title)|\(track.artist)|\(track.album)|\(Int(track.duration.rounded()))"
        return Insecure.SHA1.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func fetch(_ track: Track) async -> Record? {
        let duration = track.duration > 0 ? Int(track.duration.rounded()) : nil

        // 1. Exact match: best quality when artist and title are both known.
        if !track.artist.isEmpty {
            var items = [
                URLQueryItem(name: "artist_name", value: track.artist),
                URLQueryItem(name: "track_name", value: track.title),
            ]
            if !track.album.isEmpty { items.append(URLQueryItem(name: "album_name", value: track.album)) }
            if let duration { items.append(URLQueryItem(name: "duration", value: String(duration))) }
            switch await request(Record.self, path: "get", items: items) {
            case .success(let record?) where record.syncedLyrics != nil || record.plainLyrics != nil:
                return record
            case .failure:
                return nil
            default:
                break
            }
        }

        // 2. Fuzzy search, preferring synced lyrics with the closest duration.
        var items = [URLQueryItem(name: "track_name", value: track.title)]
        if !track.artist.isEmpty { items.append(URLQueryItem(name: "artist_name", value: track.artist)) }
        switch await request([Record].self, path: "search", items: items) {
        case .success(let list?):
            let best = list
                .filter { $0.syncedLyrics != nil || $0.plainLyrics != nil }
                .min { a, b in
                    if (a.syncedLyrics != nil) != (b.syncedLyrics != nil) { return a.syncedLyrics != nil }
                    guard let duration else { return false }
                    return abs((a.duration ?? 0) - Double(duration)) < abs((b.duration ?? 0) - Double(duration))
                }
            return best ?? Record()
        case .success(nil):
            return Record()
        case .failure:
            return nil
        }
    }

    /// `.success(nil)` is a definitive "not found"; `.failure` is a transient error.
    private static func request<T: Decodable>(_ type: T.Type, path: String, items: [URLQueryItem]) async -> Result<T?, Error> {
        var components = URLComponents(string: "https://lrclib.net/api/\(path)")!
        components.queryItems = items
        var request = URLRequest(url: components.url!)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 404 { return .success(nil) }
            guard (200..<300).contains(status) else { return .failure(URLError(.badServerResponse)) }
            return .success(try? JSONDecoder().decode(type, from: data))
        } catch {
            return .failure(error)
        }
    }

    private static func parse(_ record: Record) -> Lyrics {
        if let synced = record.syncedLyrics {
            let lines = parseLRC(synced)
            if !lines.isEmpty { return .synced(lines) }
        }
        if let plain = record.plainLyrics?.trimmingCharacters(in: .whitespacesAndNewlines), !plain.isEmpty {
            return .plain(plain)
        }
        return .none
    }

    // MARK: Sidecar files

    private static func encoding(_ cf: CFStringEncodings) -> String.Encoding {
        String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(cf.rawValue)))
    }

    /// Legacy encodings common for hand-made .lrc files, most likely first.
    private static let legacyEncodings: [String.Encoding] = [
        encoding(.GB_18030_2000), encoding(.big5), .shiftJIS, encoding(.EUC_KR),
    ]

    /// Reads a text file of unknown encoding: UTF-8 or a BOM-marked UTF-16
    /// first, then the legacy encodings, accepting only a lossless decode.
    static func decode(_ data: Data) -> String? {
        if data.starts(with: [0xEF, 0xBB, 0xBF]) {
            return String(data: data.dropFirst(3), encoding: .utf8)
        }
        if data.starts(with: [0xFF, 0xFE]) || data.starts(with: [0xFE, 0xFF]) {
            return String(data: data, encoding: .utf16)
        }
        if let text = String(data: data, encoding: .utf8) { return text }

        var converted: NSString?
        var lossy: ObjCBool = false
        let detected = NSString.stringEncoding(
            for: data,
            encodingOptions: [
                .suggestedEncodingsKey: legacyEncodings.map { NSNumber(value: $0.rawValue) },
                .useOnlySuggestedEncodingsKey: true,
                .allowLossyKey: false,
            ],
            convertedString: &converted,
            usedLossyConversion: &lossy
        )
        guard detected != 0, !lossy.boolValue, let converted else { return nil }
        return converted as String
    }

    /// An .lrc's text without its timestamps and `[ar:…]`-style tag lines.
    static func plainLRC(_ text: String) -> String {
        let tag = /^\s*\[[A-Za-z#]+:[^\]]*\]\s*$/
        return text
            .split(omittingEmptySubsequences: false, whereSeparator: \.isNewline)
            .map(String.init)
            .filter { !$0.contains(tag) }
            .map { $0.replacing(/\[\d+:\d+(?:[.:]\d+)?\]/, with: "").trimmingCharacters(in: .whitespaces) }
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func parseLRC(_ text: String) -> [LyricLine] {
        let stamp = /\[(\d+):(\d+(?:[.:]\d+)?)\]/
        var entries: [(TimeInterval, String)] = []
        for raw in text.split(whereSeparator: \.isNewline) {
            let line = String(raw)
            let stamps = line.matches(of: stamp)
            guard !stamps.isEmpty else { continue }
            let lyric = line.replacing(stamp, with: "").trimmingCharacters(in: .whitespaces)
            for match in stamps {
                let minutes = Double(match.output.1) ?? 0
                let seconds = Double(match.output.2.replacingOccurrences(of: ":", with: ".")) ?? 0
                entries.append((minutes * 60 + seconds, lyric))
            }
        }
        return entries
            .sorted { $0.0 < $1.0 }
            .enumerated()
            .map { LyricLine(id: $0.offset, time: $0.element.0, text: $0.element.1) }
    }
}

/// Lyrics already loaded this session, so a lyrics view can show them the
/// moment it appears (e.g. as the player slides in) instead of loading.
final class LyricsCache {
    static let shared = LyricsCache()
    private var values: [String: Lyrics] = [:]

    static func key(_ track: Track) -> String {
        "\(track.path)|\(track.title)|\(track.artist)|\(Int(track.duration))"
    }

    func cached(_ track: Track) -> Lyrics? { values[Self.key(track)] }

    func load(_ track: Track) async -> Lyrics {
        if let value = cached(track) { return value }
        let value = await LyricsService.lyrics(for: track)
        values[Self.key(track)] = value
        return value
    }
}
