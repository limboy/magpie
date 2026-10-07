import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var ui
    @Environment(PlayerEngine.self) private var player
    @State private var keyMonitor: Any?
    @State private var window: NSWindow?

    var body: some View {
        ZStack {
            switch ui.mode {
            case .list:
                LibraryView()
                    .transition(.opacity)
            case .player:
                PlayerModeView()
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.96)),
                        removal: .opacity.combined(with: .scale(scale: 0.98))
                    ))
            }
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
