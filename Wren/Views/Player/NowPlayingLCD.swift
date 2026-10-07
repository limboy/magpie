import SwiftUI

/// The Apple Music–style "LCD" in the toolbar: artwork, title, and progress.
struct NowPlayingLCD: View {
    @Environment(PlayerEngine.self) private var player
    @Environment(AppState.self) private var ui
    @State private var hoveringArt = false

    var body: some View {
        let track = player.currentTrack
        HStack(spacing: 10) {
            Button {
                ui.toggleMode()
            } label: {
                ArtworkView(path: player.currentPath, maxPixel: 96, cornerRadius: 5)
                    .frame(width: 36, height: 36)
                    .overlay {
                        if hoveringArt && player.currentPath != nil {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(.black.opacity(0.4))
                                .overlay {
                                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                        }
                    }
            }
            .buttonStyle(.plain)
            .onHover { hoveringArt = $0 }
            .help("Show Player (⇧⌘F)")

            VStack(spacing: 1) {
                if let track {
                    Text(track.title)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(1)
                    Text(track.subtitle.isEmpty ? " " : track.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else {
                    Image(systemName: "music.note")
                        .font(.system(size: 18))
                        .foregroundStyle(.tertiary)
                        .frame(maxHeight: .infinity)
                }
                if track != nil {
                    Scrubber(compact: true)
                        .padding(.top, -1)
                }
            }
            .frame(maxWidth: .infinity)

            FavoriteButton(path: player.currentPath, size: 11)
                .foregroundStyle(.secondary)
        }
        .padding(.leading, 4)
        .padding(.trailing, 6)
        // The toolbar won't shrink a principal item, so size it to leave room
        // for the sidebar, transport, filter and search around it.
        .frame(width: min(460, max(220, ui.contentWidth - 700)))
        .frame(height: 44)
        .glassEffect(.regular, in: .rect(cornerRadius: 10))
    }
}
