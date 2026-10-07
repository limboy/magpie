import SwiftUI

struct LyricsPanel: View {
    @Environment(PlayerEngine.self) private var player
    @Environment(\.lyricsStatic) private var isStatic
    var fontSize: CGFloat = 28

    @State private var lyrics: Lyrics?
    @State private var loadedKey: String?

    init(fontSize: CGFloat = 28) {
        self.fontSize = fontSize
    }

    var body: some View {
        let track = player.currentTrack
        let key = track.map(LyricsCache.key)
        // Already-loaded lyrics show at once, with no loading state.
        let shown = lyrics ?? track.flatMap(LyricsCache.shared.cached)
        Group {
            switch shown {
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
                let body = Text(text)
                    .font(.system(size: fontSize * 0.7, weight: .semibold))
                    .foregroundStyle(.primary.opacity(0.85))
                    .lineSpacing(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 40)
                Group {
                    if isStatic {
                        body.frame(maxHeight: .infinity, alignment: .top).clipped()
                    } else {
                        ScrollView(showsIndicators: false) { body.textSelection(.enabled) }
                    }
                }
                .mask(edgeFade)
            case .none?:
                message("No lyrics found.", symbol: "quote.bubble")
            }
        }
        .task(id: key) {
            guard let track, key != loadedKey else { return }
            lyrics = LyricsCache.shared.cached(track)
            if lyrics != nil {
                loadedKey = key
                return
            }
            // Metadata may still be loading; give it a beat so we search with real tags.
            if track.duration == 0 { try? await Task.sleep(for: .milliseconds(600)) }
            guard !Task.isCancelled else { return }
            let result = await LyricsCache.shared.load(track)
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
    @Environment(\.lyricsStatic) private var isStatic
    let lines: [LyricLine]
    let fontSize: CGFloat

    /// Pauses auto-scrolling for a moment after the user scrolls by hand.
    @State private var userScrolledAt: Date?

    var body: some View {
        let active = activeIndex(at: player.currentTime + 0.2)
        if isStatic {
            staticLines(active: active)
        } else {
            scrollingLines(active: active)
        }
    }

    private func lineView(_ line: LyricLine, active: Int?) -> some View {
        LyricLineView(
            text: line.text,
            distance: active.map { abs(line.id - $0) } ?? 99,
            isActive: line.id == active,
            fontSize: fontSize
        )
    }

    /// The lines around the current one, placed where the scroll view puts
    /// them (current line's 32% point at 32% of the height), without a scroll
    /// view: plain SwiftUI views follow the player's slide, AppKit ones don't.
    private func staticLines(active: Int?) -> some View {
        let anchor = active ?? 0
        let nearby = lines[max(0, anchor - 10)..<min(lines.count, anchor + 14)]
        return GeometryReader { geometry in
            // An overlay keeps the panel's size and lets the lines overflow
            // it, aligned on the current line.
            Color.clear
                .frame(width: geometry.size.width, height: geometry.size.height)
                .alignmentGuide(.lyricAnchor) { $0.height * 0.32 }
                .overlay(alignment: Alignment(horizontal: .leading, vertical: .lyricAnchor)) {
                    VStack(alignment: .leading, spacing: fontSize * 0.75) {
                        ForEach(nearby) { line in
                            lineView(line, active: active)
                                .modifier(LyricAnchorGuide(isAnchor: line.id == anchor))
                        }
                    }
                    .frame(width: geometry.size.width)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .clipped()
        }
        .mask(edgeFade)
    }

    private func scrollingLines(active: Int?) -> some View {
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: fontSize * 0.75) {
                        Color.clear.frame(height: geometry.size.height * 0.3)
                        ForEach(lines) { line in
                            lineView(line, active: active)
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
                    // Jump straight to the current line, even if this appears
                    // inside an animation (like the player sliding in).
                    var jump = Transaction()
                    jump.disablesAnimations = true
                    withTransaction(jump) {
                        proxy.scrollTo(active ?? 0, anchor: UnitPoint(x: 0, y: 0.32))
                    }
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

extension VerticalAlignment {
    private enum LyricAnchor: AlignmentID {
        static func defaultValue(in context: ViewDimensions) -> CGFloat { context[.top] }
    }

    /// Where the current lyric line sits in the static layout.
    fileprivate static let lyricAnchor = VerticalAlignment(LyricAnchor.self)
}

private struct LyricAnchorGuide: ViewModifier {
    let isAnchor: Bool

    func body(content: Content) -> some View {
        if isAnchor {
            content.alignmentGuide(.lyricAnchor) { $0.height * 0.32 }
        } else {
            content
        }
    }
}

extension EnvironmentValues {
    /// Draw lyrics without a scroll view, e.g. while the player slides.
    @Entry var lyricsStatic = false
}
