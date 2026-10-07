import AppKit
import SwiftUI

/// The sidebar and song list in an AppKit split view. NavigationSplitView
/// re-lays out the whole SwiftUI window, toolbar included, on every frame of
/// the sidebar's slide; here only the split view and the song list do.
struct LibrarySplitView: NSViewControllerRepresentable {
    @Environment(LibraryStore.self) private var library
    @Environment(PlayerEngine.self) private var player
    @Environment(AppState.self) private var ui

    func makeNSViewController(context: Context) -> LibrarySplitController {
        LibrarySplitController(
            sidebar: SidebarView().environment(library).environment(player).environment(ui),
            detail: TrackListView().environment(library).environment(player).environment(ui),
            ui: ui
        )
    }

    func updateNSViewController(_ controller: LibrarySplitController, context: Context) {}
}

final class LibrarySplitController: NSSplitViewController {
    private let sidebarItem: NSSplitViewItem
    private weak var ui: AppState?
    private var collapseObservation: NSKeyValueObservation?
    private var hasPlacedSidebar = false
    private static let autosaveName = "LibrarySplit"

    init(sidebar: some View, detail: some View, ui: AppState) {
        let sidebarHost = NSHostingController(rootView: sidebar)
        sidebarHost.sizingOptions = []
        sidebarHost.sceneBridgingOptions = []
        let detailHost = NSHostingController(rootView: detail)
        detailHost.sizingOptions = []
        // The song list owns the window's toolbar.
        detailHost.sceneBridgingOptions = [.toolbars]

        sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebarHost)
        sidebarItem.minimumThickness = 180
        sidebarItem.maximumThickness = 320
        sidebarItem.canCollapse = true
        self.ui = ui
        super.init(nibName: nil, bundle: nil)

        addSplitViewItem(sidebarItem)
        addSplitViewItem(NSSplitViewItem(viewController: detailHost))
        splitView.autosaveName = Self.autosaveName

        ui.toggleSidebar = { [weak self] in self?.toggleSidebar(nil) }
        collapseObservation = sidebarItem.observe(\.isCollapsed, options: [.initial, .new]) { [weak self] _, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.ui?.isSidebarCollapsed = self.sidebarItem.isCollapsed
            }
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    /// The sidebar's width until the split view has saved one of its own.
    override func viewDidAppear() {
        super.viewDidAppear()
        guard !hasPlacedSidebar else { return }
        hasPlacedSidebar = true
        if UserDefaults.standard.object(forKey: "NSSplitView Subview Frames \(Self.autosaveName)") == nil {
            splitView.setPosition(220, ofDividerAt: 0)
        }
    }
}

/// Shows and hides the sidebar, from the song list's toolbar.
struct SidebarToggle: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        let title = ui.isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"
        Button {
            ui.toggleSidebar()
        } label: {
            Label(title, systemImage: "sidebar.left")
        }
        .help(title)
    }
}
