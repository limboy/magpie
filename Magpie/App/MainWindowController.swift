import AppKit
import Observation
import SwiftUI

/// The main window, in AppKit so its toolbar follows the split view's
/// dividers: the song list's items stay over the song list, whichever
/// sidebars are open. SwiftUI draws everything inside, and the title item.
final class MainWindowController: NSWindowController, NSWindowDelegate, NSToolbarDelegate, NSMenuDelegate {
    private let library: LibraryStore
    private let player: PlayerEngine
    private let ui: AppState
    private let split: LibrarySplitController
    /// The latest item made for each identifier, to update in place.
    private var items: [NSToolbarItem.Identifier: NSToolbarItem] = [:]
    private var searchFocusRequest: Int
    private var wantsSearchFocus = false

    init(library: LibraryStore, player: PlayerEngine, ui: AppState) {
        self.library = library
        self.player = player
        self.ui = ui
        split = LibrarySplitController(library: library, player: player, ui: ui)
        searchFocusRequest = ui.searchFocusRequest

        let root = NSHostingController(
            rootView: ContentView(split: split).environment(library).environment(player).environment(ui)
        )
        root.sceneBridgingOptions = []
        let window = NSWindow(contentViewController: root)
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window.title = "Magpie"
        window.toolbarStyle = .unified
        if !window.setFrameUsingName(Self.frameName) {
            window.setContentSize(NSSize(width: 1080, height: 720))
            window.center()
        }
        window.setFrameAutosaveName(Self.frameName)
        super.init(window: window)

        window.delegate = self
        let toolbar = NSToolbar(identifier: "Main")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        window.toolbar = toolbar
        ui.window = window
        update()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private static let frameName = "MainWindow"

    // MARK: State

    /// Applies the app's state to the window and toolbar, and again whenever
    /// what it read changes.
    private func update() {
        withObservationTracking {
            apply()
        } onChange: { [weak self] in
            Task { @MainActor in self?.update() }
        }
    }

    private func apply() {
        guard let window, let toolbar = window.toolbar else { return }
        let mode = ui.settledMode
        let identifiers = Self.identifiers(for: mode, inBook: ui.openBook != nil, sidebar: !ui.isSidebarCollapsed)
        if toolbar.itemIdentifiers != identifiers { toolbar.itemIdentifiers = identifiers }
        // The player covers this view rather than replacing it, so the toolbar
        // stays put; over the player it just turns clear.
        window.titlebarAppearsTransparent = mode != .list
        // The collection name over the song count, as the toolbar's title.
        let hasCollections = !library.collections.isEmpty
        let listTitle = ui.openBook.map { library.track(for: $0).title } ?? library.title(for: library.listSelection)
        window.title = mode == .list && hasCollections ? listTitle : "Magpie"
        window.subtitle = mode == .list && hasCollections ? ui.listSummary : ""
        window.titleVisibility = mode == .list ? .visible : .hidden

        items[.sidebarButton]?.toolTip = ui.isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"
        items[.back]?.toolTip = "Back to \(library.title(for: library.listSelection)) (⌘[)"
        if let item = items[.filter] {
            item.image = Self.symbol("line.3.horizontal.decrease", "Filter and Sort", tinted: ui.onlyFavorites)
        }
        if let item = items[.playerLyrics] {
            item.image = Self.symbol(ui.showLyrics ? "quote.bubble.fill" : "quote.bubble", "Lyrics")
            item.toolTip = ui.showLyrics ? "Hide Lyrics (⌘U)" : "Show Lyrics (⌘U)"
        }
        let search = items[.search] as? NSSearchToolbarItem
        if let field = search?.searchField, field.stringValue != ui.searchText {
            field.stringValue = ui.searchText
        }
        if ui.searchFocusRequest != searchFocusRequest {
            searchFocusRequest = ui.searchFocusRequest
            wantsSearchFocus = true
        }
        // ⌘F over the player waits for the song list to settle.
        if wantsSearchFocus, mode == .list, let search {
            wantsSearchFocus = false
            DispatchQueue.main.async { search.beginSearchInteraction() }
        }

        // In full screen the toolbar sits in its own opaque strip that the
        // player can't reach under; let it hide until the pointer nears the top.
        if window.styleMask.contains(.fullScreen) {
            var options = NSApp.presentationOptions
            if ui.mode == .player { options.insert(.autoHideToolbar) } else { options.remove(.autoHideToolbar) }
            if options != NSApp.presentationOptions { NSApp.presentationOptions = options }
        }
    }

    func window(
        _ window: NSWindow, willUseFullScreenPresentationOptions proposedOptions: NSApplication.PresentationOptions = []
    ) -> NSApplication.PresentationOptions {
        ui.mode == .player ? proposedOptions.union(.autoHideToolbar) : proposedOptions
    }

    // MARK: Toolbar

    /// Nothing while the player slides in or out, so items never sit over the
    /// wrong view mid-slide.
    /// Add Folder and the sidebar button sit over the sidebar's trailing
    /// edge; with the sidebar hidden, only the sidebar button stays.
    private static func identifiers(
        for mode: DisplayMode?, inBook: Bool = false, sidebar: Bool = true
    ) -> [NSToolbarItem.Identifier] {
        switch mode {
        case .list?:
            (sidebar ? [.flexibleSpace, .addFolder] : []) + [.sidebarButton, .sidebarDivider] + (inBook ? [.back] : [])
                + [.flexibleSpace, .filter, .search, .lyricsDivider]
        case .player?:
            [.flexibleSpace, .playerLyrics, .closePlayer]
        case nil:
            [.flexibleSpace]
        }
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        Self.identifiers(for: ui.settledMode, inBook: ui.openBook != nil, sidebar: !ui.isSidebarCollapsed)
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        Self.identifiers(for: .list, inBook: true) + Self.identifiers(for: .player)
    }

    func toolbar(
        _ toolbar: NSToolbar, itemForItemIdentifier identifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        let item: NSToolbarItem
        switch identifier {
        case .sidebarDivider:
            item = NSTrackingSeparatorToolbarItem(identifier: identifier, splitView: split.splitView, dividerIndex: 0)
        case .lyricsDivider:
            item = NSTrackingSeparatorToolbarItem(identifier: identifier, splitView: split.splitView, dividerIndex: 1)
        case .sidebarButton:
            item = button(identifier, "Sidebar", symbol: "sidebar.left", action: #selector(sidebarClicked))
        case .addFolder:
            item = button(identifier, "Add Folder", symbol: "folder.badge.plus", action: #selector(addFolderClicked))
            item.toolTip = "Add a folder as a collection (⌘O)"
        case .back:
            item = button(identifier, "Back", symbol: "chevron.left", action: #selector(backClicked))
            item.isNavigational = true
        case .filter:
            let menuItem = NSMenuToolbarItem(itemIdentifier: identifier)
            menuItem.label = "Filter and Sort"
            menuItem.toolTip = "Filter and Sort"
            menuItem.showsIndicator = false
            let menu = NSMenu()
            menu.delegate = self
            menuItem.menu = menu
            item = menuItem
        case .search:
            let search = NSSearchToolbarItem(itemIdentifier: identifier)
            search.label = "Find in Songs"
            search.preferredWidthForSearchField = 180
            // The preferred width is only a hint; without a cap the field
            // stretches to fill the space after the sidebar divider.
            search.searchField.widthAnchor.constraint(lessThanOrEqualToConstant: 180).isActive = true
            search.resignsFirstResponderWithCancel = true
            search.searchField.placeholderString = "Find in Songs"
            search.searchField.sendsSearchStringImmediately = true
            search.searchField.target = self
            search.searchField.action = #selector(searchChanged)
            item = search
        case .playerLyrics:
            item = button(identifier, "Lyrics", symbol: "quote.bubble", action: #selector(playerLyricsClicked))
        case .closePlayer:
            item = button(identifier, "Close Player", symbol: "xmark", action: #selector(closePlayerClicked))
            item.toolTip = "Close Player (⇧⌘F)"
        default:
            return nil
        }
        items[identifier] = item
        // Fill in its state; this runs inside apply() too, which is fine.
        DispatchQueue.main.async { [weak self] in self?.apply() }
        return item
    }

    private func button(
        _ identifier: NSToolbarItem.Identifier, _ label: String, symbol: String, action: Selector
    ) -> NSToolbarItem {
        let item = NSToolbarItem(itemIdentifier: identifier)
        item.label = label
        item.image = Self.symbol(symbol, label)
        item.isBordered = true
        item.target = self
        item.action = action
        return item
    }

    private static func symbol(_ name: String, _ description: String, tinted: Bool = false) -> NSImage? {
        let image = NSImage(systemSymbolName: name, accessibilityDescription: description)
        guard tinted else { return image }
        return image?.withSymbolConfiguration(.init(paletteColors: [.controlAccentColor]))
    }

    // MARK: Actions

    @objc private func sidebarClicked() { ui.toggleSidebar() }
    @objc private func addFolderClicked() { library.presentAddFolder() }
    @objc private func backClicked() { ui.openBook = nil }
    @objc private func playerLyricsClicked() { ui.toggleLyrics() }
    @objc private func closePlayerClicked() { ui.toggleMode() }

    @objc private func searchChanged(_ field: NSSearchField) {
        ui.searchText = field.stringValue
    }

    // MARK: Filter menu

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        // A pull-down menu's first item is its title, never shown.
        menu.addItem(NSMenuItem())
        menu.addItem(menuItem("All Songs", checked: !ui.onlyFavorites) { [ui] in ui.onlyFavorites = false })
        menu.addItem(menuItem("Only Favorites", checked: ui.onlyFavorites) { [ui] in ui.onlyFavorites = true })
        menu.addItem(.separator())

        let sort = NSMenu()
        for key in SortKey.allCases {
            sort.addItem(menuItem(key.title, checked: ui.sortKey == key) { [ui] in ui.sortKey = key })
        }
        sort.addItem(.separator())
        sort.addItem(menuItem("Ascending", checked: ui.sortAscending) { [ui] in ui.sortAscending = true })
        sort.addItem(menuItem("Descending", checked: !ui.sortAscending) { [ui] in ui.sortAscending = false })
        let sortItem = NSMenuItem(title: "Sort Options", action: nil, keyEquivalent: "")
        sortItem.submenu = sort
        menu.addItem(sortItem)
    }

    private func menuItem(_ title: String, checked: Bool, action: @escaping () -> Void) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(runMenuItem), keyEquivalent: "")
        item.target = self
        item.state = checked ? .on : .off
        item.representedObject = MenuAction(action)
        return item
    }

    @objc private func runMenuItem(_ item: NSMenuItem) {
        (item.representedObject as? MenuAction)?.run()
    }
}

/// Carries a menu item's closure as its `representedObject`.
private final class MenuAction: NSObject {
    let run: () -> Void
    init(_ run: @escaping () -> Void) { self.run = run }
}

private extension NSToolbarItem.Identifier {
    static let sidebarDivider = Self("sidebarDivider")
    static let lyricsDivider = Self("lyricsDivider")
    static let sidebarButton = Self("sidebarButton")
    static let addFolder = Self("addFolder")
    static let back = Self("back")
    static let filter = Self("filter")
    static let search = Self("search")
    static let playerLyrics = Self("playerLyrics")
    static let closePlayer = Self("closePlayer")
}
