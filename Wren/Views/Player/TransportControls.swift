import SwiftUI

struct TransportControls: View {
    enum Style { case toolbar, large }

    @Environment(PlayerEngine.self) private var player
    let style: Style

    var body: some View {
        let large = style == .large
        HStack(spacing: large ? 28 : 2) {
            toggle(
                "Shuffle", symbol: "shuffle", isOn: player.shuffle
            ) { player.shuffle.toggle() }

            button("Previous", symbol: "backward.fill", size: large ? 24 : 13) { player.previous() }

            Button {
                player.togglePlayPause()
            } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: large ? 36 : 17, weight: .semibold))
                    .contentTransition(.symbolEffect(.replace))
                    .frame(width: large ? 52 : 30, height: large ? 52 : 28)
                    .contentShape(.rect)
            }
            .buttonStyle(PressableStyle())
            .help(player.isPlaying ? "Pause (Space)" : "Play (Space)")

            button("Next", symbol: "forward.fill", size: large ? 24 : 13) { player.next() }

            toggle(
                "Repeat", symbol: player.repeatMode.symbol, isOn: player.repeatMode != .off
            ) { player.repeatMode = player.repeatMode.next }
        }
        .padding(.horizontal, large ? 0 : 4)
    }

    private func button(_ title: String, symbol: String, size: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .semibold))
                .frame(width: style == .large ? 44 : 26, height: style == .large ? 44 : 28)
                .contentShape(.rect)
        }
        .buttonStyle(PressableStyle())
        .help(title)
        .disabled(player.currentPath == nil)
    }

    private func toggle(_ title: String, symbol: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        let large = style == .large
        return Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: large ? 15 : 11, weight: .semibold))
                .foregroundStyle(isOn ? (large ? AnyShapeStyle(.primary) : AnyShapeStyle(.tint)) : AnyShapeStyle(.secondary))
                .frame(width: large ? 32 : 24, height: large ? 32 : 28)
                .background {
                    if isOn && large {
                        RoundedRectangle(cornerRadius: 7).fill(.white.opacity(0.18))
                    }
                }
                .contentShape(.rect)
        }
        .buttonStyle(PressableStyle())
        .help(title)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

struct PressableStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(isEnabled ? (configuration.isPressed ? 0.6 : 1) : 0.35)
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

struct VolumeControl: View {
    @Environment(PlayerEngine.self) private var player

    var body: some View {
        HStack(spacing: 6) {
            Button {
                player.isMuted.toggle()
            } label: {
                Image(systemName: player.isMuted || player.volume == 0 ? "speaker.slash.fill" : "speaker.fill")
                    .font(.system(size: 10, weight: .semibold))
                    .frame(width: 14)
            }
            .buttonStyle(PressableStyle())
            .help(player.isMuted ? "Unmute" : "Mute")

            ThinSlider(value: player.isMuted ? 0 : player.volume, thickness: 4, activeThickness: 6) { value in
                player.isMuted = false
                player.volume = value
            } onCommit: { value in
                player.volume = value
            }

            Image(systemName: "speaker.wave.3.fill")
                .font(.system(size: 10, weight: .semibold))
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, 6)
    }
}

struct FavoriteButton: View {
    @Environment(LibraryStore.self) private var library
    let path: String?
    var size: CGFloat = 12

    var body: some View {
        let isFavorite = path.map(library.isFavorite) ?? false
        Button {
            if let path { library.toggleFavorite(path) }
        } label: {
            Image(systemName: isFavorite ? "star.fill" : "star")
                .font(.system(size: size, weight: .semibold))
                .contentTransition(.symbolEffect(.replace))
                .frame(width: size * 2, height: size * 2)
                .contentShape(.rect)
        }
        .buttonStyle(PressableStyle())
        .disabled(path == nil)
        .help(isFavorite ? "Unfavorite (⌘L)" : "Favorite (⌘L)")
    }
}
