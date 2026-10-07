import SwiftUI

struct LibraryView: View {
    var body: some View {
        // The toolbar is set up by the song list inside, which owns it. Under
        // the toolbar, as NavigationSplitView is: each side insets itself.
        LibrarySplitView()
            .ignoresSafeArea()
    }
}

struct ListModeToolbar: ToolbarContent {
    /// Nil while the player slides in or out: show nothing.
    let mode: DisplayMode?

    var body: some ToolbarContent {
        ToolbarSpacer(.flexible)
        if mode == .list {
            ToolbarItem(placement: .primaryAction) {
                FilterSortMenu()
            }
            ToolbarItem(placement: .primaryAction) {
                SongSearchField()
            }
            .sharedBackgroundVisibility(.hidden)
        } else if mode == .player {
            PlayerToolbarItems()
        }
    }
}

/// Lyrics and close, shown in the toolbar over the full player.
struct PlayerToolbarItems: ToolbarContent {
    var body: some ToolbarContent {
        ToolbarItem { PlayerLyricsButton() }
        ToolbarItem { PlayerCloseButton() }
    }
}

private struct PlayerLyricsButton: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        Button {
            ui.toggleLyrics()
        } label: {
            Label("Lyrics", systemImage: ui.showLyrics ? "quote.bubble.fill" : "quote.bubble")
        }
        .help(ui.showLyrics ? "Hide Lyrics (⌘U)" : "Show Lyrics (⌘U)")
    }
}

private struct PlayerCloseButton: View {
    @Environment(AppState.self) private var ui

    var body: some View {
        Button {
            ui.toggleMode()
        } label: {
            Label("Close Player", systemImage: "xmark")
        }
        .help("Close Player (⇧⌘F)")
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
