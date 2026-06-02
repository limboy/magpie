# SoundBox — A Smooth Audio Player for Your Local Library

SoundBox is a modern, minimalist audio player for macOS (and more). Built with a focus on simplicity and efficiency, it helps you organize and enjoy your local audio collection.

![](./assets/screenshot1.png)

## 💻 Requirements

- **macOS 12.0 (Monterey)** or later
- **Apple Silicon** (M1/M2/M3/M4 chips) recommended

## ✨ Features

- **Collection Management**: Organize your audio files into custom collections.
- **Drag & Drop Support**: Add files or entire folders instantly by dragging them into the interface.
- **Smart Metadata**: Automatically extracts title, artist, album, and embedded **album artwork** using `music-metadata`.
- **Now Playing**: Album art front and center, complete with macOS Control Center / lock-screen artwork.
- **Full Player & Lyrics**: Toggle the song list to reveal an immersive full-player view with synced, click-to-seek lyrics fetched from [LRCLIB](https://lrclib.net).
- **Wide Format Support**: Play MP3, M4A/M4B, FLAC, OGG, and WAV files with ease.
- **Volume Control**: A hover-reveal volume slider with quick mute.
- **Keyboard Shortcuts**: Space to play/pause, `←/→` to seek, `↑/↓` for volume, `m` to mute, `l` to like, `/` to search.
- **Fast Search**: Quickly find any song with real-time library filtering.
- **Live Sync**: Monitors your local folders for changes and keeps your library up to date.
- **Modern Interface**: A clean, responsive design built with Tailwind CSS and Radix UI.

## 🚀 Installation

You can download the latest version from the [Releases](https://github.com/limboy/soundbox/releases/latest) page.

## 🛠 Development

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)
- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (Recommended)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/limboy/soundbox.git
   cd soundbox
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the development server:

```bash
npm run dev
```

### Building for Production

To pack the application:

```bash
# For macOS
npm run build:mac

# For Windows
npm run build:win

# For Linux
npm run build:linux
```

The output will be available in the `dist` directory.

## 🛠 Tech Stack

- **Core**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Table**: [TanStack Table](https://tanstack.com/table)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Metadata**: [music-metadata](https://github.com/borewit/music-metadata)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📄 License

This project is licensed under the **MIT License**.

---

Made with ❤️ for music lovers.
