import SwiftUI

/// The immersive full-window player: artwork, controls, and synced lyrics
/// over a backdrop tinted by the artwork.
struct PlayerModeView: View {
    @Environment(PlayerEngine.self) private var player
    @Environment(AppState.self) private var ui

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let wide = size.width >= 820
            Group {
                if wide {
                    wideLayout(size)
                } else {
                    narrowLayout(size)
                }
            }
            .padding(.top, 68)
            .padding(.bottom, 28)
            .frame(width: size.width, height: size.height)
            .animation(.smooth(duration: 0.4), value: ui.showLyrics)
        }
        .background { AmbientBackground().ignoresSafeArea() }
        .ignoresSafeArea()
        .environment(\.colorScheme, .dark)
        .foregroundStyle(.white)
        .toolbar {
            ToolbarSpacer(.flexible)
            ToolbarItem {
                Button {
                    ui.toggleLyrics()
                } label: {
                    Label("Lyrics", systemImage: ui.showLyrics ? "quote.bubble.fill" : "quote.bubble")
                }
                .help(ui.showLyrics ? "Hide Lyrics (⌘U)" : "Show Lyrics (⌘U)")
            }
            ToolbarItem {
                ModeToggleButton()
            }
        }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .toolbar(removing: .title)
    }

    // MARK: Layouts

    @ViewBuilder
    private func wideLayout(_ size: CGSize) -> some View {
        let columnWidth = min(440, size.width * 0.4)
        let artSide = min(columnWidth, size.height - 290)
        HStack(spacing: 56) {
            if !ui.showLyrics { Spacer(minLength: 0) }
            NowPlayingPanel(artSide: artSide)
                .frame(width: columnWidth)
            if ui.showLyrics {
                LyricsPanel(fontSize: 30)
                    .frame(maxWidth: 620, maxHeight: .infinity)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 64)
    }

    @ViewBuilder
    private func narrowLayout(_ size: CGSize) -> some View {
        let width = min(size.width - 56, 460)
        VStack(spacing: 18) {
            if ui.showLyrics {
                CompactTrackHeader()
                    .frame(width: width)
                LyricsPanel(fontSize: 24)
                    .frame(width: width)
                    .frame(maxHeight: .infinity)
                    .transition(.opacity)
                PlaybackControls()
                    .frame(width: width)
            } else {
                Spacer(minLength: 0)
                NowPlayingPanel(artSide: min(width, size.height - 320))
                    .frame(width: width)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Artwork, title, and every control, stacked.
private struct NowPlayingPanel: View {
    @Environment(PlayerEngine.self) private var player
    let artSide: CGFloat

    var body: some View {
        VStack(spacing: 22) {
            ArtworkView(path: player.currentPath, maxPixel: 1200, cornerRadius: 12)
                .frame(width: max(120, artSide), height: max(120, artSide))
                .shadow(color: .black.opacity(0.35), radius: player.isPlaying ? 30 : 14, y: player.isPlaying ? 16 : 6)
                .scaleEffect(player.isPlaying ? 1 : 0.86)
                .animation(.spring(duration: 0.55, bounce: 0.3), value: player.isPlaying)
                .frame(maxWidth: .infinity)
            TrackTitle()
            PlaybackControls()
        }
    }
}

private struct TrackTitle: View {
    @Environment(PlayerEngine.self) private var player

    var body: some View {
        let track = player.currentTrack
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(track?.title ?? "Not Playing")
                    .font(.system(size: 19, weight: .semibold))
                    .lineLimit(1)
                Text(track?.subtitle ?? " ")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            FavoriteButton(path: player.currentPath, size: 15)
                .foregroundStyle(.white.opacity(0.8))
        }
    }
}

private struct CompactTrackHeader: View {
    @Environment(PlayerEngine.self) private var player

    var body: some View {
        HStack(spacing: 14) {
            ArtworkView(path: player.currentPath, maxPixel: 200, cornerRadius: 8)
                .frame(width: 64, height: 64)
                .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
            TrackTitle()
        }
    }
}

private struct PlaybackControls: View {
    var body: some View {
        VStack(spacing: 18) {
            Scrubber()
            TransportControls(style: .large)
            VolumeControl()
                .padding(.horizontal, -6)
        }
    }
}
