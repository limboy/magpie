import SwiftUI

struct LyricsPanel: View {
    @Environment(PlayerEngine.self) private var player
    var fontSize: CGFloat = 28

    @State private var lyrics: Lyrics?
    @State private var loadedKey: String?

    var body: some View {
        let track = player.currentTrack
        let key = track.map { "\($0.path)|\($0.title)|\($0.artist)|\(Int($0.duration))" }
        Group {
            switch lyrics {
            case nil:
                if track == nil {
                    message("Play something to see its lyrics.", symbol: "music.note")
                } else {
                    ProgressView().controlSize(.regular)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            case .synced(let lines):
                SyncedLyricsView(lines: lines, fontSize: fontSize)
            case .plain(let text):
                ScrollView(showsIndicators: false) {
                    Text(text)
                        .font(.system(size: fontSize * 0.7, weight: .semibold))
                        .foregroundStyle(.primary.opacity(0.85))
                        .lineSpacing(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 40)
                        .textSelection(.enabled)
                }
                .mask(edgeFade)
            case .none?:
                message("No lyrics found.", symbol: "quote.bubble")
            }
        }
        .task(id: key) {
            guard let track, key != loadedKey else { return }
            lyrics = nil
            // Metadata may still be loading; give it a beat so we search with real tags.
            if track.duration == 0 { try? await Task.sleep(for: .milliseconds(600)) }
            guard !Task.isCancelled else { return }
            let result = await LyricsService.lyrics(for: track)
            guard !Task.isCancelled else { return }
            lyrics = result
            loadedKey = key
        }
    }

    private func message(_ text: String, symbol: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.system(size: 28, weight: .light))
            Text(text).font(.callout)
        }
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private var edgeFade: some View {
    LinearGradient(
        stops: [
            .init(color: .clear, location: 0),
            .init(color: .black, location: 0.12),
            .init(color: .black, location: 0.85),
            .init(color: .clear, location: 1),
        ],
        startPoint: .top, endPoint: .bottom
    )
}

private struct SyncedLyricsView: View {
    @Environment(PlayerEngine.self) private var player
    let lines: [LyricLine]
    let fontSize: CGFloat

    /// Pauses auto-scrolling for a moment after the user scrolls by hand.
    @State private var userScrolledAt: Date?

    var body: some View {
        let active = activeIndex(at: player.currentTime + 0.2)
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: fontSize * 0.75) {
                        Color.clear.frame(height: geometry.size.height * 0.3)
                        ForEach(lines) { line in
                            LyricLineView(
                                text: line.text,
                                distance: active.map { abs(line.id - $0) } ?? 99,
                                isActive: line.id == active,
                                fontSize: fontSize
                            )
                            .id(line.id)
                            .onTapGesture {
                                player.seek(to: line.time)
                                userScrolledAt = nil
                            }
                        }
                        Color.clear.frame(height: geometry.size.height * 0.6)
                    }
                }
                .onScrollPhaseChange { _, phase in
                    if phase == .interacting { userScrolledAt = Date() }
                }
                .onChange(of: active) {
                    if let userScrolledAt, Date().timeIntervalSince(userScrolledAt) < 3 { return }
                    withAnimation(.spring(duration: 0.7, bounce: 0.15)) {
                        proxy.scrollTo(active ?? 0, anchor: UnitPoint(x: 0, y: 0.32))
                    }
                }
                .onAppear {
                    proxy.scrollTo(active ?? 0, anchor: UnitPoint(x: 0, y: 0.32))
                }
            }
        }
        .mask(edgeFade)
    }

    private func activeIndex(at time: TimeInterval) -> Int? {
        var low = 0, high = lines.count - 1, found: Int?
        while low <= high {
            let mid = (low + high) / 2
            if lines[mid].time <= time {
                found = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        return found
    }
}

private struct LyricLineView: View {
    let text: String
    let distance: Int
    let isActive: Bool
    let fontSize: CGFloat

    @State private var hovering = false

    var body: some View {
        Text(text.isEmpty ? "♪" : text)
            .font(.system(size: fontSize, weight: .bold))
            .foregroundStyle(.primary.opacity(isActive ? 1 : (hovering ? 0.6 : 0.3)))
            .blur(radius: isActive || hovering ? 0 : min(2.5, Double(distance) * 0.6))
            .scaleEffect(isActive ? 1 : 0.96, anchor: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 2)
            .contentShape(.rect)
            .onHover { hovering = $0 }
            .animation(.smooth(duration: 0.45), value: isActive)
            .animation(.easeOut(duration: 0.15), value: hovering)
    }
}
