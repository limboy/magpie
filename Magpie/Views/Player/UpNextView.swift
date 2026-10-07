import SwiftUI

/// What plays after the current song: songs added with Play Next or Add to
/// Queue, then the rest of the queue. Double-click a song to jump to it.
struct UpNextView: View {
    @Environment(PlayerEngine.self) private var player
    @Environment(LibraryStore.self) private var library

    /// Enough to see what's coming without laying out thousands of rows.
    private static let aheadLimit = 100

    var body: some View {
        let ahead = player.queueAhead.prefix(Self.aheadLimit)
        Group {
            if player.upNext.isEmpty && ahead.isEmpty {
                ContentUnavailableView(
                    "Nothing Up Next", systemImage: "list.bullet",
                    description: Text("Right-click songs to play them next or add them to the queue.")
                )
            } else {
                List {
                    if !player.upNext.isEmpty {
                        Section {
                            ForEach(player.upNext) { entry in
                                row(entry.path)
                                    .onTapGesture(count: 2) { player.playFromUpNext(entry.id) }
                                    .contextMenu {
                                        Button("Play") { player.playFromUpNext(entry.id) }
                                        Button("Remove from Up Next") { player.removeFromUpNext([entry.id]) }
                                    }
                            }
                            .onMove { player.moveUpNext(from: $0, to: $1) }
                        } header: {
                            HStack {
                                Text("Playing Next")
                                Spacer()
                                Button("Clear") { player.clearUpNext() }
                                    .buttonStyle(.link)
                            }
                        }
                    }
                    if !ahead.isEmpty {
                        Section("Continue Playing") {
                            // Offsets as IDs: with repeat on, a song can come round twice.
                            ForEach(Array(ahead.enumerated()), id: \.offset) { _, path in
                                row(path)
                                    .onTapGesture(count: 2) { player.playFromQueue(path) }
                                    .contextMenu {
                                        Button("Play") { player.playFromQueue(path) }
                                    }
                            }
                        }
                    }
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
            }
        }
        .frame(width: 340, height: 440)
    }

    private func row(_ path: String) -> some View {
        let track = library.track(for: path)
        return HStack(spacing: 10) {
            ArtworkView(path: path, maxPixel: 64, cornerRadius: 3)
                .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(track.title)
                    .font(.system(size: 13))
                    .lineLimit(1)
                if !track.subtitle.isEmpty {
                    Text(track.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if track.duration > 0 {
                Text(formatTime(track.duration))
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(.rect)
    }
}
