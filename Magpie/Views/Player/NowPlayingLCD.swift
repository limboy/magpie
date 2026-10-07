import SwiftUI

/// The player bar that floats over the bottom of the song list, modeled on
/// Apple Music's: transport controls, then artwork with title and a scrolling
/// artist/album line over a thin progress bar, then favorite and more — all
/// in one glass capsule.
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
                        MarqueeText(text: track?.subtitle ?? "", isActive: player.isPlaying)
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
            if !isCompact { moreMenu }
        }
    }

    // Star and more share one size and weight.
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
                Button("Get Info") { ui.infoPath = path }
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

/// A single line that scrolls sideways when it doesn't fit, resting at the
/// start between passes. Scrolls only while `isActive` (e.g. playing).
///
/// Drawn by AppKit and moved with a Core Animation layer animation, which runs
/// in the render server: animating the offset in SwiftUI redrew the glass
/// player every frame and cost ~20% CPU.
struct MarqueeText: NSViewRepresentable {
    let text: String
    var isActive = true
    var font: NSFont = .systemFont(ofSize: 12)
    var color: NSColor = .secondaryLabelColor

    func makeNSView(context: Context) -> MarqueeView { MarqueeView() }

    func updateNSView(_ view: MarqueeView, context: Context) {
        view.configure(text: text, font: font, color: color, active: isActive)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, nsView: MarqueeView, context: Context) -> CGSize? {
        CGSize(width: proposal.width ?? 100, height: ceil(font.ascender - font.descender + font.leading) + 1)
    }
}

final class MarqueeView: NSView {
    // Plain layers rather than subviews: AppKit manages views' backing layers
    // and doesn't play well with animations added to them.
    private let strip = CALayer()
    private let first = CATextLayer()
    private let second = CATextLayer()
    private let fade = CAGradientLayer()
    private var text = ""
    private var font: NSFont = .systemFont(ofSize: 12)
    private var color: NSColor = .secondaryLabelColor
    private var active = false
    private var animatedDistance: CGFloat = 0

    private let gap: CGFloat = 36
    private let speed: Double = 28
    private let pause: Double = 2.5

    init() {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.masksToBounds = true
        layer?.addSublayer(strip)
        for label in [first, second] {
            label.truncationMode = .none
            label.isWrapped = false
            strip.addSublayer(label)
        }
        fade.startPoint = CGPoint(x: 0, y: 0.5)
        fade.endPoint = CGPoint(x: 1, y: 0.5)
        fade.colors = [NSColor.clear.cgColor, NSColor.black.cgColor, NSColor.black.cgColor, NSColor.clear.cgColor]
        fade.locations = [0, 0.04, 0.92, 1]
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var wantsUpdateLayer: Bool { true }

    func configure(text: String, font: NSFont, color: NSColor, active: Bool) {
        guard text != self.text || font != self.font || color != self.color || active != self.active else { return }
        self.text = text
        self.font = font
        self.color = color
        self.active = active
        needsLayout = true
        needsDisplay = true
    }

    /// Colors resolve against the current appearance, so restyle here.
    override func updateLayer() {
        var attributes: [NSAttributedString.Key: Any] = [.font: font]
        effectiveAppearance.performAsCurrentDrawingAppearance {
            attributes[.foregroundColor] = color.cgColor
        }
        let string = NSAttributedString(string: text, attributes: attributes)
        let scale = window?.backingScaleFactor ?? 2
        for label in [first, second] {
            label.string = string
            label.contentsScale = scale
        }
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        needsDisplay = true
    }

    override func layout() {
        super.layout()
        let textWidth = ceil((text as NSString).size(withAttributes: [.font: font]).width)
        let height = bounds.height
        let overflows = textWidth > bounds.width + 1

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        first.frame = CGRect(x: 0, y: 0, width: textWidth + 2, height: height)
        second.frame = CGRect(x: textWidth + gap, y: 0, width: textWidth + 2, height: height)
        second.isHidden = !overflows
        strip.frame = CGRect(x: 0, y: 0, width: textWidth * 2 + gap + 2, height: height)
        fade.frame = bounds
        layer?.mask = overflows ? fade : nil
        CATransaction.commit()

        let distance = overflows && active ? textWidth + gap : 0
        if distance == animatedDistance && (distance == 0 || strip.animation(forKey: "marquee") != nil) { return }
        animatedDistance = distance
        strip.removeAnimation(forKey: "marquee")
        guard distance > 0 else { return }

        // Rest, then glide one copy's width left so the second copy lands where
        // the first began; the loop restarts seamlessly from there.
        let travel = Double(distance) / speed
        let animation = CAKeyframeAnimation(keyPath: "position.x")
        let start = strip.position.x
        animation.values = [start, start, start - distance].map { NSNumber(value: Double($0)) }
        animation.keyTimes = [0, NSNumber(value: pause / (pause + travel)), 1]
        animation.duration = pause + travel
        animation.repeatCount = .infinity
        animation.isRemovedOnCompletion = false
        strip.add(animation, forKey: "marquee")
    }
}
