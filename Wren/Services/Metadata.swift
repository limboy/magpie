import AVFoundation
import AppKit
import ImageIO

/// CGImage is immutable, so handing it across actors is safe.
nonisolated struct SendableImage: @unchecked Sendable {
    let cgImage: CGImage
}

nonisolated struct RGB: Sendable, Equatable {
    var r: Double, g: Double, b: Double
}

nonisolated enum MetadataReader {
    @concurrent static func read(path: String) async -> CachedTrack {
        let asset = AVURLAsset(url: URL(fileURLWithPath: path))
        var track = Track.placeholder(path: path)
        if let (metadata, duration) = try? await asset.load(.commonMetadata, .duration) {
            if duration.seconds.isFinite { track.duration = duration.seconds }
            if let title = await string(metadata, .commonIdentifierTitle) { track.title = title }
            if let artist = await string(metadata, .commonIdentifierArtist) { track.artist = artist }
            if let album = await string(metadata, .commonIdentifierAlbumName) { track.album = album }
        }
        return CachedTrack(track: track, modified: AudioFiles.modificationDate(path) ?? .distantPast)
    }

    private static func string(_ items: [AVMetadataItem], _ identifier: AVMetadataIdentifier) async -> String? {
        guard let item = AVMetadataItem.metadataItems(from: items, filteredByIdentifier: identifier).first,
              let value = try? await item.load(.stringValue)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty, value != "Unknown"
        else { return nil }
        return value
    }

    /// Paths whose cached metadata is missing or older than the file on disk.
    @concurrent static func stale(_ paths: [String], known: [String: Date]) async -> [String] {
        paths.filter { path in
            guard let cached = known[path] else { return true }
            guard let modified = AudioFiles.modificationDate(path) else { return false }
            return modified > cached
        }
    }

    // MARK: Artwork

    private static let folderArtNames = ["cover", "folder", "front", "album", "artwork"]
    private static let folderArtExtensions = ["jpg", "jpeg", "png", "webp"]

    @concurrent static func artwork(path: String, maxPixel: Int) async -> SendableImage? {
        guard let data = await artworkData(path: path) else { return nil }
        return thumbnail(data, maxPixel: maxPixel)
    }

    private static func artworkData(path: String) async -> Data? {
        let asset = AVURLAsset(url: URL(fileURLWithPath: path))
        if let metadata = try? await asset.load(.commonMetadata),
           let item = AVMetadataItem.metadataItems(from: metadata, filteredByIdentifier: .commonIdentifierArtwork).first,
           let data = try? await item.load(.dataValue) {
            return data
        }
        // Fall back to a cover image sitting next to the file, common for FLAC rips.
        let folder = (path as NSString).deletingLastPathComponent
        let files = (try? FileManager.default.contentsOfDirectory(atPath: folder)) ?? []
        let cover = files.first { file in
            let name = (file as NSString).deletingPathExtension.lowercased()
            let ext = (file as NSString).pathExtension.lowercased()
            return folderArtNames.contains(name) && folderArtExtensions.contains(ext)
        }
        return cover.flatMap { try? Data(contentsOf: URL(fileURLWithPath: folder).appendingPathComponent($0)) }
    }

    private static func thumbnail(_ data: Data, maxPixel: Int) -> SendableImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary).map(SendableImage.init)
    }

    /// A 3×3 grid of colours sampled from the artwork, tuned to sit behind white text.
    @concurrent static func palette(path: String) async -> [RGB]? {
        guard let image = await artwork(path: path, maxPixel: 64)?.cgImage else { return nil }
        let side = 3
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress, width: side, height: side, bitsPerComponent: 8,
                bytesPerRow: side * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.interpolationQuality = .medium
            context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
            return true
        }
        guard drawn else { return nil }
        return (0..<side * side).map { i in
            let color = NSColor(
                srgbRed: CGFloat(pixels[i * 4]) / 255, green: CGFloat(pixels[i * 4 + 1]) / 255,
                blue: CGFloat(pixels[i * 4 + 2]) / 255, alpha: 1
            )
            var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            color.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
            let tuned = NSColor(
                hue: h, saturation: min(1, s * 1.25), brightness: min(0.66, max(0.3, b * 0.9)), alpha: 1
            ).usingColorSpace(.sRGB)!
            return RGB(r: tuned.redComponent, g: tuned.greenComponent, b: tuned.blueComponent)
        }
    }
}

/// Decoded artwork, shared by every view that shows the same file.
@Observable
final class ArtworkCache {
    static let shared = ArtworkCache()

    /// Bumped when a file changes on disk, so views showing it reload.
    private(set) var generations: [String: Int] = [:]

    @ObservationIgnored private let images = NSCache<NSString, NSImage>()
    @ObservationIgnored private var palettes: [String: [RGB]] = [:]
    @ObservationIgnored private var inflight: [String: Task<NSImage?, Never>] = [:]
    @ObservationIgnored private var missing: Set<String> = []

    func generation(_ path: String) -> Int { generations[path] ?? 0 }

    private func key(_ path: String, _ maxPixel: Int) -> String {
        "\(path)#\(maxPixel)#\(generation(path))"
    }

    func cached(_ path: String, maxPixel: Int) -> NSImage? {
        images.object(forKey: key(path, maxPixel) as NSString)
    }

    func image(_ path: String, maxPixel: Int) async -> NSImage? {
        let key = key(path, maxPixel)
        if let image = images.object(forKey: key as NSString) { return image }
        if missing.contains(path) { return nil }
        if let task = inflight[key] { return await task.value }

        let task = Task<NSImage?, Never> {
            guard let art = await MetadataReader.artwork(path: path, maxPixel: maxPixel) else { return nil }
            return NSImage(cgImage: art.cgImage, size: .zero)
        }
        inflight[key] = task
        let image = await task.value
        inflight[key] = nil
        if let image {
            images.setObject(image, forKey: key as NSString)
        } else {
            missing.insert(path)
        }
        return image
    }

    func palette(_ path: String) async -> [RGB]? {
        if let palette = palettes[path] { return palette }
        if missing.contains(path) { return nil }
        let palette = await MetadataReader.palette(path: path)
        if let palette { palettes[path] = palette }
        return palette
    }

    /// Drops everything known about files that changed on disk.
    func invalidate(_ paths: some Sequence<String>) {
        for path in paths {
            missing.remove(path)
            palettes[path] = nil
            generations[path, default: 0] += 1
        }
    }
}
