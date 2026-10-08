import SwiftUI
import UniformTypeIdentifiers

struct SidebarView: View {
    @Environment(LibraryStore.self) private var library
    @State private var renaming: UUID?
    @State private var draftName = ""
    @FocusState private var listFocused: Bool
    @FocusState private var renameFocused: Bool

    var body: some View {
        @Bindable var library = library
        List(selection: $library.selection) {
            Section("Library") {
                Self.label("Favorites", systemImage: "star")
                    .tag(SidebarItem.favorites)
            }
            Section("Collections") {
                ForEach(library.collections) { collection in
                    row(collection)
                        .tag(SidebarItem.collection(collection.id))
                        // Dropping onto a collection adds to it.
                        .onDrop(of: [.fileURL], isTargeted: nil) { providers in
                            Task { await library.add(await Self.fileURLs(providers), to: collection.id) }
                            return true
                        }
                        .contextMenu { menu(for: collection) }
                }
                // Between rows and the empty space below them. The List's
                // table view takes every drag over it, so the List-level
                // onDrop never sees these; without this they're refused.
                .onInsert(of: [.fileURL]) { _, providers in
                    Task { await library.addCollections(from: await Self.fileURLs(providers)) }
                }
            }
        }
        .focused($listFocused)
        // Clicking an already selected row must also take focus back from
        // the AppKit song table; a selection-change handler misses that case.
        .simultaneousGesture(TapGesture().onEnded {
            if renaming == nil { listFocused = true }
        })
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if library.isLoadingMetadata {
                ProgressView()
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
            }
        }
        // Dropping outside the list's rows makes new collections.
        .onDrop(of: [.fileURL], isTargeted: nil) { providers in
            Task { await library.addCollections(from: await Self.fileURLs(providers)) }
            return true
        }
    }

    /// File URLs from a drag, read via NSItemProvider (Finder supplies them as
    /// file-URL data).
    static func fileURLs(_ providers: [NSItemProvider]) async -> [URL] {
        var urls: [URL] = []
        for provider in providers {
            let url = await withCheckedContinuation { continuation in
                _ = provider.loadObject(ofClass: URL.self) { url, _ in continuation.resume(returning: url) }
            }
            if let url { urls.append(url) }
        }
        return urls
    }

    /// The sidebar bolds a selected row while it has focus, but kept the
    /// bold on that row after focus and then the selection moved elsewhere.
    /// A weight on the Text itself (not the Label, which the sidebar's
    /// style overrides) keeps every row regular.
    private static func label(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title).fontWeight(.regular)
        } icon: {
            Image(systemName: systemImage)
        }
    }

    @ViewBuilder
    private func row(_ collection: LibraryCollection) -> some View {
        if renaming == collection.id {
            Label {
                TextField("Name", text: $draftName)
                    .textFieldStyle(.plain)
                    .focused($renameFocused)
                    .onSubmit { commitRename() }
                    .onExitCommand { renaming = nil }
                    .onChange(of: renameFocused) { if !renameFocused { commitRename() } }
            } icon: {
                Image(systemName: "folder")
            }
        } else {
            Self.label(collection.name, systemImage: "folder")
        }
    }

    @ViewBuilder
    private func menu(for collection: LibraryCollection) -> some View {
        Button("Rename") {
            draftName = collection.name
            renaming = collection.id
            renameFocused = true
        }
        if !collection.folders.isEmpty {
            Button("Show in Finder") { library.revealInFinder(collection.folders) }
        }
        Button("Refresh") { Task { await library.refresh() } }
        Divider()
        Button("Remove Collection", role: .destructive) { library.deleteCollection(collection.id) }
    }

    private func commitRename() {
        if let id = renaming { library.rename(id, to: draftName) }
        renaming = nil
    }
}
