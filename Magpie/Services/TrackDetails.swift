import AVFoundation

/// Technical details for the Get Info sheet, read on demand.
nonisolated struct TrackDetails: Sendable {
    var kind: String
    var bitrate: Int?
    var sampleRate: Double?
    var channels: Int?
    var fileSize: Int64?
    var year: String?
    var genre: String?

    @concurrent static func read(path: String) async -> TrackDetails {
        let url = URL(fileURLWithPath: path)
        var details = TrackDetails(kind: url.pathExtension.uppercased())
        details.fileSize = (try? FileManager.default.attributesOfItem(atPath: path))?[.size] as? Int64

        let asset = AVURLAsset(url: url)
        if let track = try? await asset.loadTracks(withMediaType: .audio).first,
           let (rate, descriptions) = try? await track.load(.estimatedDataRate, .formatDescriptions) {
            if rate > 0 { details.bitrate = Int((rate / 1000).rounded()) }
            if let description = descriptions.first {
                details.kind = codecName(CMFormatDescriptionGetMediaSubType(description)) ?? details.kind
                if let format = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee {
                    details.sampleRate = format.mSampleRate
                    details.channels = Int(format.mChannelsPerFrame)
                }
            }
        }

        if let metadata = try? await asset.load(.metadata) {
            details.year = await firstString(metadata, [
                .commonIdentifierCreationDate, .id3MetadataYear, .id3MetadataRecordingTime, .iTunesMetadataReleaseDate,
            ]).map { String($0.prefix(4)) }
            details.genre = await firstString(metadata, [
                .id3MetadataContentType, .iTunesMetadataUserGenre, .quickTimeMetadataGenre,
            ])
        }
        return details
    }

    private static func firstString(_ items: [AVMetadataItem], _ identifiers: [AVMetadataIdentifier]) async -> String? {
        for identifier in identifiers {
            for item in AVMetadataItem.metadataItems(from: items, filteredByIdentifier: identifier) {
                if let value = try? await item.load(.stringValue)?.trimmingCharacters(in: .whitespaces), !value.isEmpty {
                    return value
                }
            }
        }
        return nil
    }

    private static func codecName(_ subtype: FourCharCode) -> String? {
        switch subtype {
        case kAudioFormatMPEGLayer3: "MP3"
        case kAudioFormatMPEG4AAC, kAudioFormatMPEG4AAC_HE, kAudioFormatMPEG4AAC_HE_V2: "AAC"
        case kAudioFormatAppleLossless: "Apple Lossless"
        case kAudioFormatFLAC: "FLAC"
        case kAudioFormatLinearPCM: "PCM"
        case kAudioFormatOpus: "Opus"
        default: nil
        }
    }
}
