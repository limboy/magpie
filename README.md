# Magpie

A native macOS 26+ audio player for your local library, written in SwiftUI + AVFoundation. A native rewrite of the Electron [Magpie](../magpie), modeled on Apple Music.

## Two modes

- **List mode**: collections in the sidebar and a song table. The toolbar holds transport controls, an Apple Music–style "LCD" (artwork, title, progress), a filter/sort menu (All Songs / Only Favorites, sort by any column) and "Find in Songs" search.
- **Player mode**: a full-window player with large artwork, synced lyrics (click a line to seek), and a backdrop tinted by the artwork.

Switch modes with ⇧⌘F, the toolbar button, or a click on the LCD artwork. Each mode keeps its own window size.

## Features

- Add folders as collections (⌘O or drag & drop). Folders are watched live with FSEvents: added, renamed, deleted and retagged files show up within about a second. ⌘R forces a full rescan.
- Reads title, artist, album, duration and artwork, falling back to `cover.jpg`/`folder.jpg` next to the files. Metadata is cached.
- Lyrics: a sidecar `.lrc` first, then [LRCLIB](https://lrclib.net). Lyrics are cached on disk.
- Favorites, play counts, shuffle, repeat (all/one).
- Reopens the last song where you left off. Long tracks (≥10 min) remember their position.
- Now Playing / Control Center integration and media keys.
- Shortcuts: Space play/pause · ⌘←/→ previous/next · ⇧⌘←/→ ±15s · ⌘↑/↓ volume · ⌘L favorite · ⌘U lyrics (in the player) · ⌘F search.

## Build

```bash
xcodegen generate
xcodebuild -project Magpie.xcodeproj -scheme Magpie -configuration Debug -derivedDataPath build build
open build/Build/Products/Debug/Magpie.app
```

Formats: MP3, AAC/M4A/M4B, ALAC, FLAC, WAV, AIFF, CAF. OGG isn't supported by AVFoundation.
