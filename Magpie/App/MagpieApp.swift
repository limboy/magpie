import SwiftUI

@main
struct MagpieApp: App {
    @NSApplicationDelegateAdaptor private var app: AppDelegate

    var body: some Scene {
        // The main window is AppKit's (MainWindowController); this scene only
        // carries the menus.
        Settings { EmptyView() }
            .commands {
                MagpieCommands(library: app.library, player: app.player, ui: app.ui, updater: app.updater)
                CommandGroup(replacing: .appSettings) {}
            }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    let ui: AppState
    let library: LibraryStore
    let player: PlayerEngine
    let updater = Updater()
    private var windowController: MainWindowController?

    override init() {
        // Before anything reads the library or settings.
        Storage.migrateFromWren()
        ui = AppState()
        library = LibraryStore()
        player = PlayerEngine(library: library)
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // One window, no tabs (and no tab items in the View menu).
        NSWindow.allowsAutomaticWindowTabbing = false
        let controller = MainWindowController(library: library, player: player, ui: ui)
        windowController = controller
        controller.showWindow(nil)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows { windowController?.showWindow(nil) }
        return true
    }

    // As with a single SwiftUI Window scene: closing the window quits.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@Observable
final class AppState {
    var mode: DisplayMode = .list
    /// The mode once its transition has finished; nil while the player slides
    /// in or out. Drives the toolbar (so its items never sit over the wrong
    /// view mid-slide) and the player's lyrics.
    private(set) var settledMode: DisplayMode? = .list
    var searchText = ""
    /// The song count and length under the collection name, from the song list.
    var listSummary = ""
    var showLyrics = UserDefaults.standard.object(forKey: "showLyrics") as? Bool ?? true {
        didSet { UserDefaults.standard.set(showLyrics, forKey: "showLyrics") }
    }
    /// Bumped to ask the library view to focus its search field.
    var searchFocusRequest = 0
    /// The book opened in the song list, showing its chapters.
    var openBook: String?
    /// The song shown in the Get Info sheet, if open.
    var infoPath: String?
    var onlyFavorites = UserDefaults.standard.bool(forKey: "onlyFavorites") {
        didSet { UserDefaults.standard.set(onlyFavorites, forKey: "onlyFavorites") }
    }
    var sortKey = SortKey(rawValue: UserDefaults.standard.string(forKey: "sortKey") ?? "") ?? .order {
        didSet { UserDefaults.standard.set(sortKey.rawValue, forKey: "sortKey") }
    }
    var sortAscending = UserDefaults.standard.object(forKey: "sortAscending") as? Bool ?? true {
        didSet { UserDefaults.standard.set(sortAscending, forKey: "sortAscending") }
    }

    /// Kept in step by the library's split view, which also does the toggling.
    var isSidebarCollapsed = false
    var isLyricsSidebarCollapsed = true
    var sidebarWidth = LibraryLayout.defaultSidebarWidth
    @ObservationIgnored var toggleSidebar: () -> Void = {}
    @ObservationIgnored var toggleLyricsSidebar: () -> Void = {}

    /// The window's minimum content size in a mode. The song list's leaves
    /// it room beside whichever sidebars are open.
    func minimumSize(for mode: DisplayMode) -> CGSize {
        var size = mode.minimumSize
        guard mode == .list else { return size }
        let sidebars = (isSidebarCollapsed ? 0 : sidebarWidth) + (isLyricsSidebarCollapsed ? 0 : LibraryLayout.lyricsWidth)
        size.width = max(size.width, LibraryLayout.songsMinimumWidth + sidebars)
        return size
    }

    /// Whether ⌘U would hide lyrics: the player's, or the song list's sidebar.
    var lyricsShown: Bool { mode == .player ? showLyrics : !isLyricsSidebarCollapsed }

    @ObservationIgnored weak var window: NSWindow?
    /// Each mode keeps its own window size, so a small player window doesn't
    /// squeeze the song list (and vice versa).
    @ObservationIgnored private var savedSizes: [DisplayMode: NSSize] = [:]

    /// ⌘U and the lyrics buttons: the player's lyrics, or over the song list,
    /// its lyrics sidebar.
    func toggleLyrics() {
        guard mode == .player else { return toggleLyricsSidebar() }
        withAnimation(.smooth) { showLyrics.toggle() }
    }

    func toggleMode() {
        let new: DisplayMode = mode == .list ? .player : .list
        let switchMode = {
            self.settledMode = nil
            withAnimation(.smooth(duration: 0.3)) {
                self.mode = new
            } completion: {
                // A quick second toggle may have moved on already.
                if self.mode == new { self.settledMode = new }
            }
        }
        guard let window, !window.styleMask.contains(.fullScreen) else { return switchMode() }

        savedSizes[mode] = window.frame.size
        var size = savedSizes[new] ?? window.frame.size
        let minimum = window.frameRect(forContentRect: NSRect(origin: .zero, size: minimumSize(for: new))).size
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
