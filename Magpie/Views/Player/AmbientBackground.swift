import SwiftUI

/// A slowly drifting mesh gradient tinted by the current artwork.
struct AmbientBackground: View {
    @Environment(PlayerEngine.self) private var player
    let path: String?
    @State private var colors: [Color]

    init(path: String?) {
        self.path = path
        // Start from the palette if it's ready, so the player doesn't open on
        // the fallback colors and then shift.
        _colors = State(initialValue: Self.colors(path.flatMap(ArtworkCache.shared.cachedPalette)))
    }

    private static func colors(_ palette: [RGB]?) -> [Color] {
        palette.map { $0.map { Color(red: $0.r, green: $0.g, blue: $0.b) } } ?? fallback
    }

    private static let fallback: [Color] = [
        Color(red: 0.16, green: 0.14, blue: 0.22), Color(red: 0.22, green: 0.16, blue: 0.26), Color(red: 0.12, green: 0.12, blue: 0.18),
        Color(red: 0.20, green: 0.18, blue: 0.28), Color(red: 0.26, green: 0.20, blue: 0.30), Color(red: 0.15, green: 0.14, blue: 0.22),
        Color(red: 0.10, green: 0.10, blue: 0.14), Color(red: 0.18, green: 0.15, blue: 0.22), Color(red: 0.12, green: 0.11, blue: 0.16),
    ]

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !player.isPlaying)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            MeshGradient(width: 3, height: 3, points: points(t), colors: colors, smoothsColors: true)
        }
        .overlay(.black.opacity(0.28))
        .task(id: path.map { "\($0)#\(ArtworkCache.shared.generation($0))" }) {
            let next = Self.colors(await path.asyncMap { await ArtworkCache.shared.palette($0) } ?? nil)
            guard next != colors else { return }
            withAnimation(.easeInOut(duration: 1.2)) { colors = next }
        }
    }

    private func points(_ t: TimeInterval) -> [SIMD2<Float>] {
        func wobble(_ phase: Double, _ speed: Double) -> Float {
            Float(sin(t * speed + phase) * 0.12)
        }
        return [
            [0, 0], [0.5 + wobble(0, 0.21), 0], [1, 0],
            [0, 0.5 + wobble(1, 0.17)], [0.5 + wobble(2, 0.23), 0.5 + wobble(3, 0.19)], [1, 0.5 + wobble(4, 0.15)],
            [0, 1], [0.5 + wobble(5, 0.18), 1], [1, 1],
        ]
    }
}

extension Optional {
    func asyncMap<T>(_ transform: (Wrapped) async -> T) async -> T? {
        guard let self else { return nil }
        return await transform(self)
    }
}
