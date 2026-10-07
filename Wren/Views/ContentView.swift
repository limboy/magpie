import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var ui
    @Environment(PlayerEngine.self) private var player
    @State private var keyMonitor: Any?
    @State private var window: NSWindow?

    var body: some View {
        // The song list stays alive under the player, which slides up over the
        // whole window. Nothing beneath changes, so nothing re-lays out.
        ZStack {
            // Never squeezed below its own minimum while the smaller player
            // window covers it: its split views can't fit and AppKit loops
            // on their constraints until it throws. Any overflow goes off the
            // left edge, so the toolbar's trailing section (the player's
            // buttons) stays in the window.
            GeometryReader { geometry in
                let minimum = DisplayMode.list.minimumSize
                LibraryView()
                    .frame(
                        width: max(geometry.size.width, minimum.width),
                        height: max(geometry.size.height, minimum.height)
                    )
                    .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topTrailing)
            }
            // The player's layer spans the whole window, toolbar area
            // included, so its size never changes while it slides.
            GeometryReader { geometry in
                if ui.mode == .player {
                    PlayerModeView()
                        .transition(.modifier(
                            active: SlideLayout(offset: geometry.size.height),
                            identity: SlideLayout(offset: 0)
                        ))
                }
            }
            .ignoresSafeArea()
            // Keeps it on top while it slides out; otherwise the removal
            // drops behind the list and just vanishes.
            .zIndex(1)
            .allowsHitTesting(ui.mode == .player)
        }
        .frame(minWidth: ui.mode.minimumSize.width, minHeight: ui.mode.minimumSize.height)
        .background(WindowReader(window: $window))
        .onAppear(perform: installKeyMonitor)
        .sheet(isPresented: Binding(get: { ui.infoPath != nil }, set: { if !$0 { ui.infoPath = nil } })) {
            if let path = ui.infoPath { TrackInfoView(path: path) }
        }
        .onChange(of: window) { ui.window = window }
    }

    /// Space toggles playback anywhere except while editing text.
    private func installKeyMonitor() {
        guard keyMonitor == nil else { return }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            guard event.keyCode == 49, modifiers.subtracting(.capsLock).isEmpty else { return event }
            let isEditingText = event.window?.firstResponder is NSText
            guard !isEditingText else { return event }
            MainActor.assumeIsolated { player.togglePlayPause() }
            return nil
        }
    }
}

/// Hands back the NSWindow hosting this view.
private struct WindowReader: NSViewRepresentable {
    @Binding var window: NSWindow?

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async { window = view.window }
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        if window == nil { DispatchQueue.main.async { window = view.window } }
    }
}

/// Slides by moving the view's layout rather than with a visual offset (as
/// `.move` does): native AppKit views inside, like the lyrics' scroll view,
/// only follow layout, so this keeps them moving with everything else.
private struct SlideLayout: ViewModifier {
    let offset: CGFloat

    func body(content: Content) -> some View {
        content
            // Native views aren't clipped by the window edge mid-slide, so
            // keep everything inside the player's own bounds.
            .clipped()
            .padding(.top, offset)
            .padding(.bottom, -offset)
    }
}
