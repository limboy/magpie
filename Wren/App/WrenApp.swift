import SwiftUI

@main
struct WrenApp: App {
    @State private var library: LibraryStore
    @State private var player: PlayerEngine
    @State private var ui = AppState()

    init() {
        let library = LibraryStore()
        _library = State(initialValue: library)
        _player = State(initialValue: PlayerEngine(library: library))
    }

    var body: some Scene {
        Window("Wren", id: "main") {
            ContentView()
                .environment(library)
                .environment(player)
                .environment(ui)
        }
        .defaultSize(width: 1080, height: 720)
        .windowToolbarStyle(.unified)
        .commands { WrenCommands(library: library, player: player, ui: ui) }
    }
}

@Observable
final class AppState {
    var mode: DisplayMode = .list
    var searchText = ""
    var showLyrics = UserDefaults.standard.object(forKey: "showLyrics") as? Bool ?? true {
        didSet { UserDefaults.standard.set(showLyrics, forKey: "showLyrics") }
    }
    /// Bumped to ask the library view to focus its search field.
    var searchFocusRequest = 0
    var onlyFavorites = UserDefaults.standard.bool(forKey: "onlyFavorites") {
        didSet { UserDefaults.standard.set(onlyFavorites, forKey: "onlyFavorites") }
    }
    var sortKey = SortKey(rawValue: UserDefaults.standard.string(forKey: "sortKey") ?? "") ?? .order {
        didSet { UserDefaults.standard.set(sortKey.rawValue, forKey: "sortKey") }
    }
    var sortAscending = UserDefaults.standard.object(forKey: "sortAscending") as? Bool ?? true {
        didSet { UserDefaults.standard.set(sortAscending, forKey: "sortAscending") }
    }

    @ObservationIgnored weak var window: NSWindow?
    /// Each mode keeps its own window size, so a small player window doesn't
    /// squeeze the song list (and vice versa).
    @ObservationIgnored private var savedSizes: [DisplayMode: NSSize] = [:]

    func toggleMode() {
        let new: DisplayMode = mode == .list ? .player : .list
        let switchMode = { withAnimation(.smooth(duration: 0.4)) { self.mode = new } }
        guard let window, !window.styleMask.contains(.fullScreen) else { return switchMode() }

        savedSizes[mode] = window.frame.size
        var size = savedSizes[new] ?? window.frame.size
        let minimum = window.frameRect(forContentRect: NSRect(origin: .zero, size: new.minimumSize)).size
        size.width = max(size.width, minimum.width)
        size.height = max(size.height, minimum.height)
        // Keep the top-left corner where it is.
        let frame = NSRect(x: window.frame.minX, y: window.frame.maxY - size.height, width: size.width, height: size.height)

        if new == .list {
            // The list's minimum is larger: resize first so it's already met.
            window.setFrame(frame, display: true, animate: true)
            switchMode()
        } else {
            // The player's minimum is smaller: switch first so it's in place.
            switchMode()
            DispatchQueue.main.async { window.setFrame(frame, display: true, animate: true) }
        }
    }
}
