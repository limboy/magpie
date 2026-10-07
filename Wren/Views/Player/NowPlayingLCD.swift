import SwiftUI

/// The player bar that floats over the bottom of the song list, modeled on
/// Apple Music's: transport controls, then artwork with title and a scrolling
/// artist/album line over a thin progress bar, then favorite, more, and
/// lyrics — all in one glass capsule.
struct NowPlayingLCD: View {
    @Environment(PlayerEngine.self) private var player
    @Environment(LibraryStore.self) private var library
    @Environment(AppState.self) private var ui
    @State private var hovering = false
    @State private var hoveringArt = false
    @State private var width: CGFloat = 760

    /// Narrow windows drop shuffle, repeat and the more menu.
    private var isCompact: Bool { width < 440 }

    var body: some View {
        HStack(spacing: 10) {
            TransportControls(style: .toolbar, showsModes: !isCompact)
            nowPlaying
                .frame(maxWidth: .infinity)
            accessories
        }
        .padding(.leading, 10)
        .padding(.trailing, 12)
        .frame(maxWidth: 760)
        .frame(height: 54)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        // Song rows scroll underneath, so back the glass with a thick
        // material to keep the text over it readable.
        .background(.thickMaterial, in: .capsule)
        .glassEffect(.regular, in: .capsule)
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
        .onHover { hovering = $0 }
    }

    // MARK: Now playing

    private var nowPlaying: some View {
        let track = player.currentTrack
        return HStack(spacing: 10) {
            artwork
            // The progress bar sits under the text, starting where the title does.
            VStack(alignment: .leading, spacing: 1) {
                Text(track?.title ?? "Not Playing")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(track == nil ? .secondary : .primary)
                    .lineLimit(1)
                if track != nil {
                    if hovering {
                        TimeLabels()
                    } else {
                        MarqueeText(text: track?.subtitle ?? "")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }
                ThinSlider(
                    value: player.duration > 0 ? player.currentTime / player.duration : 0,
                    thickness: 3, activeThickness: 5
                ) { _ in } onCommit: { player.seek(to: $0 * player.duration) }
                    .frame(height: 6)
                    .padding(.top, 2)
                    .disabled(track == nil)
            }
        }
    }

    private var artwork: some View {
        Button {
            ui.toggleMode()
        } label: {
            ArtworkView(path: player.currentPath, maxPixel: 96, cornerRadius: 4)
                .frame(width: 38, height: 38)
                .overlay {
                    if hoveringArt && player.currentPath != nil {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.black.opacity(0.4))
                            .overlay {
                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                    }
                }
        }
        .buttonStyle(.plain)
        .onHover { hoveringArt = $0 }
        .help("Show Player (⇧⌘F)")
    }

    // MARK: Accessories

    private var accessories: some View {
        HStack(spacing: 2) {
            FavoriteButton(path: player.currentPath, size: Self.iconSize, weight: Self.iconWeight)

            Button {
                ui.toggleLyrics()
            } label: {
                accessoryIcon(ui.showLyricsSidebar ? "quote.bubble.fill" : "quote.bubble")
                    .foregroundStyle(ui.showLyricsSidebar ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
            }
            .buttonStyle(PressableStyle())
            .help(ui.showLyricsSidebar ? "Hide Lyrics (⌘U)" : "Show Lyrics (⌘U)")

            if !isCompact { moreMenu }
        }
    }

    // Star, lyrics and more share one size and weight.
    private static let iconSize: CGFloat = 15
    private static let iconWeight: Font.Weight = .medium

    private func accessoryIcon(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: Self.iconSize, weight: Self.iconWeight))
            .frame(width: Self.iconSize * 2, height: Self.iconSize * 2)
            .contentShape(.rect)
    }

    private var moreMenu: some View {
        Menu {
            Button("Show Player") { ui.toggleMode() }
            if let path = player.currentPath {
                Button("Show in Finder") { library.revealInFinder([path]) }
                Divider()
                Button(library.isFavorite(path) ? "Unfavorite" : "Favorite") { library.toggleFavorite(path) }
            }
        } label: {
            accessoryIcon("ellipsis")
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("More")
    }
}

/// Elapsed and remaining time, shown in place of the artist line on hover.
private struct TimeLabels: View {
    @Environment(PlayerEngine.self) private var player

    var body: some View {
        HStack {
            Text(formatTime(player.currentTime))
            Spacer()
            Text(formatTime(-(player.duration - player.currentTime)))
        }
        .font(.system(size: 11, weight: .medium).monospacedDigit())
        .foregroundStyle(.secondary)
    }
}

/// A single line that scrolls sideways when it doesn't fit, pausing at the start.
struct MarqueeText: View {
    let text: String

    @State private var textWidth: CGFloat = 0
    @State private var boxWidth: CGFloat = 0

    private let gap: CGFloat = 36
    private let speed: Double = 28
    private let pause: Double = 2.5

    var body: some View {
        let overflows = textWidth > boxWidth + 1
        Text(text.isEmpty ? " " : text)
            .lineLimit(1)
            .hidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { boxWidth = $0 }
            .overlay(alignment: .leading) {
                TimelineView(.animation(minimumInterval: 1 / 30, paused: !overflows)) { context in
                    HStack(spacing: gap) {
                        Text(text)
                        if overflows { Text(text) }
                    }
                    .fixedSize()
                    .offset(x: overflows ? offset(at: context.date) : 0)
                }
            }
            .background {
                Text(text)
                    .fixedSize()
                    .hidden()
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { textWidth = $0 }
            }
            .clipped()
            .mask {
                if overflows {
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0), .init(color: .black, location: 0.04),
                            .init(color: .black, location: 0.92), .init(color: .clear, location: 1),
                        ],
                        startPoint: .leading, endPoint: .trailing
                    )
                } else {
                    Rectangle()
                }
            }
    }

    private func offset(at date: Date) -> CGFloat {
        let distance = Double(textWidth + gap)
        let period = pause + distance / speed
        let phase = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period)
        return phase < pause ? 0 : -CGFloat((phase - pause) * speed)
    }
}
