import SwiftUI

struct SidebarView: View {
    @Environment(LibraryStore.self) private var library
    @State private var renaming: UUID?
    @State private var draftName = ""
    @FocusState private var renameFocused: Bool

    var body: some View {
        @Bindable var library = library
        List(selection: $library.selection) {
            Section("Library") {
                Label("Favorites", systemImage: "star")
                    .tag(SidebarItem.favorites)
            }
            Section("Collections") {
                ForEach(library.collections) { collection in
                    row(collection)
                        .tag(SidebarItem.collection(collection.id))
                        .dropDestination(for: URL.self) { urls, _ in
                            Task { await library.add(urls, to: collection.id) }
                            return true
                        }
                        .contextMenu { menu(for: collection) }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            HStack {
                Button {
                    library.presentAddFolder()
                } label: {
                    Label("Add Folder", systemImage: "plus")
                }
                .buttonStyle(.borderless)
                .help("Add a folder as a collection (⌘O)")
                Spacer()
                if library.isLoadingMetadata {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .dropDestination(for: URL.self) { urls, _ in
            Task { await library.addCollections(from: urls) }
            return true
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
            Label(collection.name, systemImage: "folder")
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
