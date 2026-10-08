import SwiftUI

struct MagpieCommands: Commands {
    let library: LibraryStore
    let player: PlayerEngine
    let ui: AppState
    let updater: Updater

    var body: some Commands {
        CommandGroup(after: .appInfo) {
            Button("Check for Updates…") { updater.checkForUpdates() }
                .disabled(!updater.canCheckForUpdates)
        }

        CommandGroup(replacing: .newItem) {
            Button("Add Folder…") { library.presentAddFolder() }
                .keyboardShortcut("o")
            Button("Refresh Library") { Task { await library.refresh() } }
                .keyboardShortcut("r")
        }

        CommandGroup(after: .textEditing) {
            Button("Find") {
                if ui.mode == .player { ui.toggleMode() }
                ui.searchFocusRequest += 1
            }
            .keyboardShortcut("f")
        }

        CommandGroup(before: .sidebar) {
            Button(ui.mode == .list ? "Show Player" : "Show Song List") { ui.toggleMode() }
                .keyboardShortcut("f", modifiers: [.command, .shift])
            Button(ui.lyricsShown ? "Hide Lyrics" : "Show Lyrics") { ui.toggleLyrics() }
                .keyboardShortcut("u")
            Button("Back") { ui.openBook = nil }
                .keyboardShortcut("[")
                .disabled(ui.mode != .list || ui.openBook == nil)
            Divider()
        }

        CommandMenu("Controls") {
            // Space is handled by a key monitor so it never steals typing in the search field.
            Button(player.isPlaying ? "Pause" : "Play") { player.togglePlayPause() }
            Button("Next") { player.next() }
                .keyboardShortcut(.rightArrow)
            Button("Previous") { player.previous() }
                .keyboardShortcut(.leftArrow)
            Divider()
            Button("Skip Forward 15 Seconds") { player.skip(by: 15) }
                .keyboardShortcut(.rightArrow, modifiers: [.command, .shift])
            Button("Skip Back 15 Seconds") { player.skip(by: -15) }
                .keyboardShortcut(.leftArrow, modifiers: [.command, .shift])
            Divider()
            Button("Increase Volume") { player.adjustVolume(by: 0.1) }
                .keyboardShortcut(.upArrow)
            Button("Decrease Volume") { player.adjustVolume(by: -0.1) }
                .keyboardShortcut(.downArrow)
            Divider()
            Picker("Playback Speed", selection: Binding(get: { player.rate }, set: { player.rate = $0 })) {
                ForEach(PlayerEngine.rates, id: \.self) { Text(formatRate($0)).tag($0) }
            }
            Divider()
            Toggle("Shuffle", isOn: Binding(get: { player.shuffle }, set: { player.shuffle = $0 }))
            Picker("Repeat", selection: Binding(get: { player.repeatMode }, set: { player.repeatMode = $0 })) {
                Text("Off").tag(RepeatMode.off)
                Text("All").tag(RepeatMode.all)
                Text("One").tag(RepeatMode.one)
            }
            Divider()
            Button(player.currentPath.map(library.isFavorite) == true ? "Unfavorite" : "Favorite") {
                if let path = player.currentPath { library.toggleFavorite(path) }
            }
            .keyboardShortcut("l")
            .disabled(player.currentPath == nil)
        }
    }
}
