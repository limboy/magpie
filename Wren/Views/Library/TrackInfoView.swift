import SwiftUI

/// The Get Info sheet: what a song is and where it lives.
struct TrackInfoView: View {
    @Environment(LibraryStore.self) private var library
    @Environment(\.dismiss) private var dismiss
    let path: String

    @State private var details: TrackDetails?

    var body: some View {
        VStack(spacing: 0) {
            header
            Form {
                Section("Details") {
                    row("Duration", track.duration > 0 ? formatTime(track.duration) : nil)
                    row("Size", details?.fileSize.map { ByteCountFormatter.string(fromByteCount: $0, countStyle: .file) })
                    row("Year", details?.year)
                    row("Genre", details?.genre)
                    row("Plays", "\(library.plays(path))")
                    row("Date Added", dateAdded)
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)

            footer
        }
        .frame(width: 480, height: 490)
        .task(id: path) { details = await TrackDetails.read(path: path) }
    }

    private var track: Track { library.track(for: path) }

    private var footer: some View {
        HStack {
            Button("Show in Finder") { library.revealInFinder([path]) }
            Spacer()
            Button("Done") { dismiss() }
                .keyboardShortcut(.defaultAction)
        }
        .controlSize(.large)
        .padding(.horizontal, 24)
        .padding(.bottom, 20)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: 18) {
            ArtworkView(path: path, maxPixel: 320, cornerRadius: 10)
                .frame(width: 112, height: 112)
                .shadow(color: .black.opacity(0.25), radius: 12, y: 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(track.title)
                    .font(.system(size: 18, weight: .bold))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                if !track.artist.isEmpty {
                    Text(track.artist)
                        .font(.system(size: 14))
                        .lineLimit(1)
                }
                if !track.album.isEmpty {
                    Text(track.album)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                chips
                    .padding(.top, 6)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 26)
        .padding(.bottom, 18)
        .background(alignment: .top) {
            // A soft wash of the artwork's colors behind the header.
            ArtworkView(path: path, maxPixel: 120, cornerRadius: 0)
                .frame(width: 480, height: 480)
                .blur(radius: 60)
                .opacity(0.45)
                .frame(width: 480, height: 200, alignment: .top)
                .clipped()
                .mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))
                .allowsHitTesting(false)
        }
    }

    private var chips: some View {
        HStack(spacing: 6) {
            ForEach(chipTexts, id: \.self) { text in
                Text(text)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(.quaternary.opacity(0.6), in: .capsule)
            }
        }
    }

    private var chipTexts: [String] {
        guard let details else { return [] }
        // The audio format at a glance; the cards below hold everything else.
        return [
            details.kind, details.bitrate.map { "\($0) kbps" },
            details.sampleRate.map(formatSampleRate), details.channels.map(formatChannels),
        ].compactMap { $0 }
    }

    // MARK: Rows

    @ViewBuilder
    private func row(_ title: String, _ value: String?) -> some View {
        if let value {
            LabeledContent(title) {
                Text(value).textSelection(.enabled)
            }
        }
    }

    private var dateAdded: String? {
        library.addedDate(path, in: library.selection)
            .flatMap { $0 == .distantPast ? nil : $0.formatted(date: .abbreviated, time: .shortened) }
    }

    private func formatSampleRate(_ rate: Double) -> String {
        let khz = rate / 1000
        return khz == khz.rounded() ? "\(Int(khz)) kHz" : String(format: "%.1f kHz", khz)
    }

    private func formatChannels(_ count: Int) -> String {
        switch count {
        case 1: "Mono"
        case 2: "Stereo"
        default: "\(count) channels"
        }
    }
}
