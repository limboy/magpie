import SwiftUI

/// A slim capsule slider that thickens while hovered or dragged.
struct ThinSlider: View {
    /// 0...1
    var value: Double
    var thickness: CGFloat = 4
    var activeThickness: CGFloat = 7
    var onChange: (Double) -> Void = { _ in }
    var onCommit: (Double) -> Void

    @State private var dragValue: Double?
    @State private var isHovering = false

    private var isActive: Bool { isHovering || dragValue != nil }

    var body: some View {
        GeometryReader { geometry in
            let fraction = min(1, max(0, dragValue ?? value))
            let height = isActive ? activeThickness : thickness
            ZStack(alignment: .leading) {
                Capsule().fill(.primary.opacity(0.16))
                Capsule()
                    .fill(.primary.opacity(isActive ? 0.95 : 0.7))
                    .frame(width: max(height, geometry.size.width * fraction))
            }
            .frame(height: height)
            .frame(maxHeight: .infinity)
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        let newValue = min(1, max(0, drag.location.x / max(1, geometry.size.width)))
                        dragValue = newValue
                        onChange(newValue)
                    }
                    .onEnded { drag in
                        let newValue = min(1, max(0, drag.location.x / max(1, geometry.size.width)))
                        onCommit(newValue)
                        dragValue = nil
                    }
            )
        }
        .frame(height: max(activeThickness, 14))
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.15), value: isActive)
    }
}

/// Playback position with elapsed and remaining time.
struct Scrubber: View {
    @Environment(PlayerEngine.self) private var player
    var compact = false

    @State private var preview: TimeInterval?

    var body: some View {
        let duration = max(player.duration, 0.01)
        let shown = preview ?? player.currentTime
        let slider = ThinSlider(
            value: player.currentTime / duration,
            thickness: compact ? 3 : 5,
            activeThickness: compact ? 5 : 9,
            onChange: { preview = $0 * duration },
            onCommit: {
                player.seek(to: $0 * duration)
                preview = nil
            }
        )
        .disabled(player.currentPath == nil)

        if compact {
            HStack(spacing: 6) {
                time(shown).frame(width: 34, alignment: .trailing)
                slider
                time(-(player.duration - shown)).frame(width: 38, alignment: .leading)
            }
            .font(.system(size: 9, weight: .medium).monospacedDigit())
            .foregroundStyle(.secondary)
        } else {
            VStack(spacing: 4) {
                slider
                HStack {
                    time(shown)
                    Spacer()
                    time(-(player.duration - shown))
                }
                .font(.system(size: 11, weight: .medium).monospacedDigit())
                .foregroundStyle(.secondary)
            }
        }
    }

    private func time(_ seconds: TimeInterval) -> Text {
        Text(formatTime(seconds))
    }
}

func formatTime(_ seconds: TimeInterval) -> String {
    guard seconds.isFinite else { return "--:--" }
    let negative = seconds < -0.5
    let total = Int(abs(seconds).rounded())
    let h = total / 3600, m = (total % 3600) / 60, s = total % 60
    let body = h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    return negative ? "-" + body : body
}

func formatDuration(_ seconds: TimeInterval) -> String {
    let minutes = Int(seconds / 60)
    if minutes < 60 { return "\(minutes) min" }
    let hours = Double(minutes) / 60
    return hours < 10 ? String(format: "%.1f hr", hours) : "\(Int(hours)) hr"
}
