import SwiftUI

struct LibraryView: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 320)
        } detail: {
            TrackListView()
        }
        .toolbar { ListModeToolbar() }
        .toolbar(removing: .title)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { ui.contentWidth = $0 }
    }
}

struct ListModeToolbar: ToolbarContent {
    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            TransportControls(style: .toolbar)
        }
        ToolbarItem(placement: .principal) {
            NowPlayingLCD()
        }
        .sharedBackgroundVisibility(.hidden)
        ToolbarItem(placement: .primaryAction) {
            FilterSortMenu()
        }
        ToolbarItem(placement: .primaryAction) {
            SongSearchField()
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// A compact search field. `.searchable` stretches across all the free
/// toolbar space, pushing it away from the filter button.
struct SongSearchField: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        @Bindable var ui = ui
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Find in Songs", text: $ui.searchText)
                .textFieldStyle(.plain)
                .onExitCommand {
                    ui.searchText = ""
                    ui.window?.makeFirstResponder(nil)
                }
            if !ui.searchText.isEmpty {
                Button {
                    ui.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .help("Clear Search")
            }
        }
        .font(.system(size: 13))
        .padding(.horizontal, 10)
        .frame(width: 180, height: 36)
        .glassEffect(.regular.interactive(), in: .capsule)
        .onChange(of: ui.searchFocusRequest) { focusField() }
    }

    /// `@FocusState` doesn't reach into the toolbar, so ask AppKit directly.
    private func focusField() {
        guard let root = ui.window?.contentView?.superview,
              let field = Self.field(placeholder: "Find in Songs", in: root) else { return }
        ui.window?.makeFirstResponder(field)
    }

    private static func field(placeholder: String, in view: NSView) -> NSTextField? {
        if let field = view as? NSTextField, field.placeholderString == placeholder { return field }
        for subview in view.subviews {
            if let field = field(placeholder: placeholder, in: subview) { return field }
        }
        return nil
    }
}

struct FilterSortMenu: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        @Bindable var ui = ui
        Menu {
            Picker("Show", selection: $ui.onlyFavorites) {
                Text("All Songs").tag(false)
                Text("Only Favorites").tag(true)
            }
            .pickerStyle(.inline)
            .labelsHidden()
            Divider()
            Menu("Sort Options") {
                Picker("Sort By", selection: $ui.sortKey) {
                    ForEach(SortKey.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
                Divider()
                Picker("Order", selection: $ui.sortAscending) {
                    Text("Ascending").tag(true)
                    Text("Descending").tag(false)
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
        } label: {
            Label("Filter and Sort", systemImage: "line.3.horizontal.decrease")
                .foregroundStyle(ui.onlyFavorites ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
        }
        .menuIndicator(.hidden)
        .help("Filter and Sort")
    }
}

struct ModeToggleButton: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        Button {
            ui.toggleMode()
        } label: {
            Label(
                ui.mode == .list ? "Show Player" : "Show Song List",
                systemImage: ui.mode == .list ? "play.square.stack" : "list.bullet"
            )
        }
        .help(ui.mode == .list ? "Show Player (⇧⌘F)" : "Show Song List (⇧⌘F)")
    }
}
