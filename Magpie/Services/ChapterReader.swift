import AVFoundation

/// Reads a book's embedded chapters. The library caches them with the rest
/// of a file's metadata.
nonisolated enum ChapterReader {
    @concurrent static func read(_ path: String) async -> [Chapter] {
        (try? await read(AVURLAsset(url: URL(fileURLWithPath: path)))) ?? []
    }

    static func read(_ asset: AVURLAsset) async throws -> [Chapter] {
        var groups = try await asset.loadChapterMetadataGroups(bestMatchingPreferredLanguages: Locale.preferredLanguages)
        // Many audiobook tools write an undefined chapter language ("und").
        // Preferred-language matching can return nothing even when chapters exist.
        if groups.isEmpty {
            for locale in try await asset.load(.availableChapterLocales) {
                groups = try await asset.loadChapterMetadataGroups(
                    withTitleLocale: locale, containingItemsWithCommonKeys: [])
                if !groups.isEmpty { break }
            }
        }
        guard !groups.isEmpty else { return [] }
        let duration = try await asset.load(.duration).seconds
        var chapters: [Chapter] = []
        for (index, group) in groups.enumerated() {
            let item = AVMetadataItem.metadataItems(from: group.items, filteredByIdentifier: .commonIdentifierTitle).first
            let title = try await item?.load(.stringValue) ?? ""
            chapters.append(Chapter(id: index, title: title, start: group.timeRange.start.seconds,
                                    end: CMTimeRangeGetEnd(group.timeRange).seconds))
        }
        // A single "chapter" is just the whole file.
        let normalized = Chapter.normalized(chapters, duration: duration)
        return normalized.count > 1 ? normalized : []
    }
}
