import AppKit
import SwiftUI

enum LibraryLayout {
    /// Room for every column of the song list.
    static let songsMinimumWidth: CGFloat = 520
    static let lyricsWidth: CGFloat = 340
    static let defaultSidebarWidth: CGFloat = 220
}

/// Shows the window's split view, which MainWindowController makes and keeps
/// so its toolbar can follow the dividers.
struct LibrarySplitView: NSViewControllerRepresentable {
    let controller: LibrarySplitController

    func makeNSViewController(context: Context) -> LibrarySplitController { controller }

    func updateNSViewController(_ controller: LibrarySplitController, context: Context) {}
}

/// The sidebar, song list and lyrics in an AppKit split view. NavigationSplitView
/// re-lays out the whole SwiftUI window, toolbar included, on every frame of
/// a sidebar's slide; here only the split view and its panes do.
final class LibrarySplitController: NSSplitViewController {
    private let sidebarItem: NSSplitViewItem
    private let lyricsItem: NSSplitViewItem
    private weak var ui: AppState?
    private var collapseObservations: [NSKeyValueObservation] = []
    private var hasPlacedSidebar = false
    private var sidebarWidthUpdate: DispatchWorkItem?

    // Saved by hand rather than with the split view's autosave, which also
    // restores the lyrics' width over its fixed one.
    private let defaults = UserDefaults.standard
    private static let sidebarWidthKey = "sidebarWidth"
    private static let sidebarCollapsedKey = "sidebarCollapsed"
    private static let lyricsShownKey = "lyricsShown"

    init(library: LibraryStore, player: PlayerEngine, ui: AppState) {
        func host(_ view: some View) -> NSViewController {
            let host = NSHostingController(rootView: view.environment(library).environment(player).environment(ui))
            host.sizingOptions = []
            // The window's toolbar is AppKit's; nothing in here adds to it.
            host.sceneBridgingOptions = []
            return host
        }

        sidebarItem = NSSplitViewItem(sidebarWithViewController: host(SidebarView()))
        sidebarItem.minimumThickness = 180
        sidebarItem.maximumThickness = 320
        sidebarItem.canCollapse = true
        sidebarItem.isCollapsed = defaults.bool(forKey: Self.sidebarCollapsedKey)
        lyricsItem = NSSplitViewItem(inspectorWithViewController: host(LyricsSidebar()))
        // A fixed width: resizing it made the split view take the room from
        // the sidebar instead of the song list.
        lyricsItem.minimumThickness = LibraryLayout.lyricsWidth
        lyricsItem.maximumThickness = LibraryLayout.lyricsWidth
        lyricsItem.canCollapse = true
        lyricsItem.isCollapsed = !defaults.bool(forKey: Self.lyricsShownKey)
        let songsItem = NSSplitViewItem(viewController: host(TrackListView()))
        // Window resizing goes to the song list; the sidebars keep their width.
        songsItem.holdingPriority = .defaultLow
        sidebarItem.holdingPriority = .defaultLow + 10
        lyricsItem.holdingPriority = .defaultLow + 10
        self.ui = ui
        super.init(nibName: nil, bundle: nil)

        addSplitViewItem(sidebarItem)
        addSplitViewItem(songsItem)
        addSplitViewItem(lyricsItem)

        ui.sidebarWidth = defaults.object(forKey: Self.sidebarWidthKey) as? Double ?? LibraryLayout.defaultSidebarWidth
        ui.toggleSidebar = { [weak self] in self?.toggle(isSidebar: true) }
        ui.toggleLyricsSidebar = { [weak self] in self?.toggle(isSidebar: false) }
        collapseObservations = [sidebarItem, lyricsItem].map { item in
            item.observe(\.isCollapsed, options: [.initial, .new]) { [weak self] _, _ in
                MainActor.assumeIsolated { self?.collapsedChanged() }
            }
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func toggle(isSidebar: Bool) {
        let item = isSidebar ? sidebarItem : lyricsItem
        if item.isCollapsed { makeRoom(sidebar: isSidebar || !sidebarItem.isCollapsed, lyrics: !isSidebar || !lyricsItem.isCollapsed) }
        if isSidebar { toggleSidebar(nil) } else { toggleInspector(nil) }
    }

    /// Widens the window, before a sidebar opens, so the song list keeps room
    /// for its columns beside it.
    private func makeRoom(sidebar: Bool, lyrics: Bool) {
        guard let ui, let window = view.window, let content = window.contentView,
              !window.styleMask.contains(.fullScreen) else { return }
        let needed = LibraryLayout.songsMinimumWidth + (sidebar ? ui.sidebarWidth : 0) + (lyrics ? LibraryLayout.lyricsWidth : 0)
        let shortfall = needed - content.bounds.width
        guard shortfall > 0 else { return }
        var frame = window.frame
        frame.size.width += shortfall
        // Grow to the right, or leftward where the screen ends.
        if let screen = window.screen?.visibleFrame {
            frame.size.width = min(frame.width, screen.width)
            frame.origin.x = max(screen.minX, min(frame.minX, screen.maxX - frame.width))
        }
        window.setFrame(frame, display: true, animate: true)
    }

    private func collapsedChanged() {
        ui?.isSidebarCollapsed = sidebarItem.isCollapsed
        ui?.isLyricsSidebarCollapsed = lyricsItem.isCollapsed
        defaults.set(sidebarItem.isCollapsed, forKey: Self.sidebarCollapsedKey)
        defaults.set(!lyricsItem.isCollapsed, forKey: Self.lyricsShownKey)
    }

    /// The sidebar's saved width, once it's laid out.
    override func viewDidAppear() {
        super.viewDidAppear()
        guard !hasPlacedSidebar else { return }
        hasPlacedSidebar = true
        if !sidebarItem.isCollapsed { splitView.setPosition(ui?.sidebarWidth ?? LibraryLayout.defaultSidebarWidth, ofDividerAt: 0) }
    }

    override func splitViewDidResizeSubviews(_ notification: Notification) {
        super.splitViewDidResizeSubviews(notification)
        // Only settled widths: mid-slide ones are below the minimum.
        let width = sidebarItem.viewController.view.frame.width
        guard hasPlacedSidebar, !sidebarItem.isCollapsed, width >= sidebarItem.minimumThickness else { return }
        defaults.set(Double(width), forKey: Self.sidebarWidthKey)
        // Into the window's minimum once it settles, not on every frame of a
        // drag or slide.
        sidebarWidthUpdate?.cancel()
        let update = DispatchWorkItem { [weak self] in self?.ui?.sidebarWidth = width }
        sidebarWidthUpdate = update
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: update)
    }

    /// The lyrics' divider can't be dragged.
    override func splitView(
        _ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect, forDrawnRect drawnRect: NSRect,
        ofDividerAt dividerIndex: Int
    ) -> NSRect {
        dividerIndex == 1 ? .zero : super.splitView(
            splitView, effectiveRect: proposedEffectiveRect, forDrawnRect: drawnRect, ofDividerAt: dividerIndex
        )
    }
}

/// The current song's lyrics, beside the song list.
struct LyricsSidebar: View {
    var body: some View {
        LyricsPanel(fontSize: 20)
            .padding(.horizontal, 20)
    }
}
