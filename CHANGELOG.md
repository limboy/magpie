# Changelog

All notable changes to this project are documented here.
This file is generated automatically from [Conventional Commits](https://www.conventionalcommits.org/) — run `npm run changelog` to regenerate.

## [v1.3.0](https://github.com/limboy/soundbox/compare/v1.2.1...v1.3.0) - 2026-07-14

### Features

- redesign player interface ([30843d7](https://github.com/limboy/soundbox/commit/30843d7d1c924b6abb803d901c1819e80568ab95))

### Bug Fixes

- hide window title when folders page is open ([ad3fc7c](https://github.com/limboy/soundbox/commit/ad3fc7c51beababb3bebcc6a0099ee5d86607a8d))

### Documentation

- update CHANGELOG for v1.2.1 ([682cb6d](https://github.com/limboy/soundbox/commit/682cb6d3acfe49bbc593a7172cb872218e0358cb))

### Other Changes

- Tighten transport control sizing ([214c36f](https://github.com/limboy/soundbox/commit/214c36f6db2d989a543abf8c68f9c20cc02e5163))
- Expand lyrics sidebar and align player layout with wider panel ([4779171](https://github.com/limboy/soundbox/commit/47791712a7e424b4263c2cde8322a35440780c35))

## [v1.2.1](https://github.com/limboy/soundbox/compare/v1.2.0...v1.2.1) - 2026-06-04

### Documentation

- update README screenshot to reflect current UI ([d283276](https://github.com/limboy/soundbox/commit/d283276e0943d53dbaf6d83ced212c2dabc29d96))
- update CHANGELOG for v1.2.0 ([874929c](https://github.com/limboy/soundbox/commit/874929ce195fef767d741505e6e95aec68710864))

### Other Changes

- Add active state indicator dots for shuffle and loop buttons in compact player ([db58b11](https://github.com/limboy/soundbox/commit/db58b111fdd5fad50975a7651207521065007334))
- Fix index and star column widths in audio list to be strictly fixed ([7321e92](https://github.com/limboy/soundbox/commit/7321e924b57638246d668aee49a1fba206aa5b68))

## [v1.2.0](https://github.com/limboy/soundbox/compare/v1.1.1...v1.2.0) - 2026-06-03

### Features

- **compact-bar:** reveal full-player expander on artwork hover ([e14ca96](https://github.com/limboy/soundbox/commit/e14ca960cbd7fc903df9a91ba70e3da4bb64b51e))
- **window:** per-mode size limits and remembered bounds ([0376672](https://github.com/limboy/soundbox/commit/03766726e388afbba42467af3bf30f5626f03dec))
- **player:** move exit button to top bar, add star to transport ([ac59b01](https://github.com/limboy/soundbox/commit/ac59b011773515b2c8c3a004d5646ffb383ed02d))
- **player:** horizontal hover volume slider in full player ([c6dba72](https://github.com/limboy/soundbox/commit/c6dba72409e3912449c139ad70de19fabbec9e58))
- **player:** take over full window in full player mode ([132b1ef](https://github.com/limboy/soundbox/commit/132b1ef9369db9af6beb8ca00baf01c30eaf6022))
- **player:** add visual indication for currently playing audio in list ([5000f8b](https://github.com/limboy/soundbox/commit/5000f8be96745f750bd2f5b2c839fd585c4888d1))
- **audio-list:** show play/pause icon on track number ([3d16c8b](https://github.com/limboy/soundbox/commit/3d16c8bb2406b6c536233e533899144a59bb19a1))
- full-height sidebars and traffic-light sidebar toggle ([a5b43b4](https://github.com/limboy/soundbox/commit/a5b43b47110199ed25f18ffa2c977d046f9d26f7))
- lyrics sidebar toggle in compact player ([7416c7b](https://github.com/limboy/soundbox/commit/7416c7bcd0a1b81f678cd7027221e055cabf7e8a))
- Apple Music-style compact player bar ([0e03961](https://github.com/limboy/soundbox/commit/0e039618ac6b5aa9d42991e6457ba66d68c3d957))
- star-only filter, star icon, and column alignment polish ([791deb2](https://github.com/limboy/soundbox/commit/791deb28cf6a16d91983bcc88884def6b45d9d98))
- fix song list column widths and disable resizing ([ce87b4d](https://github.com/limboy/soundbox/commit/ce87b4d0fec6e552e0365f0da8e13d80db6edd86))

### Bug Fixes

- **audio-list:** remove double border under table header ([734601a](https://github.com/limboy/soundbox/commit/734601a76ee8a10218231c2e09a63bba1090deb6))
- let compact progress bar sit on the card's bottom border ([1be9e09](https://github.com/limboy/soundbox/commit/1be9e09d75b4b66f9da3fa742546a01749d587c4))

### Refactoring

- **player:** use cycle volume button in full mode ([e888ed5](https://github.com/limboy/soundbox/commit/e888ed5c64cf5133b499ec36c6861c26b099b411))
- **player:** disable sorting for duration column ([8450fb4](https://github.com/limboy/soundbox/commit/8450fb4bbb2ffdfc6e52f4d92142b61be9725349))

### Documentation

- replace screenshot in readme ([59387e9](https://github.com/limboy/soundbox/commit/59387e95e93031dc0fadaee6863ca8381d7c12bd))
- update screenshot in readme ([bbb73a1](https://github.com/limboy/soundbox/commit/bbb73a1d405c6021e0994de3c0f4991cc44e0ed3))
- update CHANGELOG for v1.1.1 ([5a644d5](https://github.com/limboy/soundbox/commit/5a644d5042fb1f99c78b8abbb480653375c5d0d0))

### Styles

- **compact-bar:** give play/pause button a filled circle ([556fcd8](https://github.com/limboy/soundbox/commit/556fcd8936589fc0986f3f7435030c3cbfaa17f7))
- **player:** increase lyrics sidebar width to w-80 ([c0491e1](https://github.com/limboy/soundbox/commit/c0491e1bcd9404696ee260d67137f21673083c13))
- adjust column widths and code formatting ([159d93d](https://github.com/limboy/soundbox/commit/159d93d27a4e07c21f1b4f09984f7d8f87238ee1))

## [v1.1.1](https://github.com/limboy/soundbox/compare/v1.1.0...v1.1.1) - 2026-06-02

### Bug Fixes

- eliminate startup UI flash before restored song appears ([d8ce3a7](https://github.com/limboy/soundbox/commit/d8ce3a78fb90885774be0e6312174972f1d7fbcb))

### Documentation

- update CHANGELOG for v1.1.0 ([5d8f55e](https://github.com/limboy/soundbox/commit/5d8f55ef83821deb80f13ad548a412797039d2ee))

### Styles

- tweak transport controls padding and formatting ([5edc7cf](https://github.com/limboy/soundbox/commit/5edc7cf4eab564567e3e05b64c39d911062bb47b))

## [v1.1.0](https://github.com/limboy/soundbox/compare/v1.0.5...v1.1.0) - 2026-06-02

### Features

- create a collection by dropping a folder on the sidebar ([ea31f8b](https://github.com/limboy/soundbox/commit/ea31f8bc454d3d72a8aa4ce2d6ec5569e9e9ab92))
- create collections via sidebar right-click menu ([29b0a09](https://github.com/limboy/soundbox/commit/29b0a096edf295288e85321ba75b2ba36d35a50d))
- add full-player view with synced lyrics ([a442eda](https://github.com/limboy/soundbox/commit/a442edab2d782de180020ab13b0f5789f73c5493))
- add album artwork, volume control, and richer keyboard shortcuts ([f740e53](https://github.com/limboy/soundbox/commit/f740e53d15c6ae5c4cb4cad2c6d5595ff27dbdf5))

### Bug Fixes

- navigate tracks in the visible sorted order ([5982024](https://github.com/limboy/soundbox/commit/5982024e34cc964f8407e23ada7192a980ae66d4))

### Documentation

- update CHANGELOG for v1.0.5 ([902f955](https://github.com/limboy/soundbox/commit/902f955bb9b84e0f7731641b14de51e3fdd54685))

### Styles

- show artwork only in full player ([e52744d](https://github.com/limboy/soundbox/commit/e52744dd806013e78441596558d5d10a84d136dc))
- taller top bar with vertically centered traffic lights ([cc3cf07](https://github.com/limboy/soundbox/commit/cc3cf075c699ec3840a63cf44d5ee1decd0d99de))

## [v1.0.5](https://github.com/limboy/soundbox/compare/v1.0.4...v1.0.5) - 2026-04-25

### Documentation

- update CHANGELOG for v1.0.4 ([27f7498](https://github.com/limboy/soundbox/commit/27f7498cfcd235f180c066c3aea09de540efc455))

### Styles

- update size and minSize constraints for audio list columns ([e2a0c5e](https://github.com/limboy/soundbox/commit/e2a0c5e258749ed05b3d17a0fc020062877dbec5))

## [v1.0.4](https://github.com/limboy/soundbox/compare/v1.0.3...v1.0.4) - 2026-04-24

### Features

- add track liking functionality with persistence and UI support ([f8d3048](https://github.com/limboy/soundbox/commit/f8d3048c355baab1657d4128caad25094e2301e0))

### Documentation

- update CHANGELOG for v1.0.3 ([0c4288a](https://github.com/limboy/soundbox/commit/0c4288acc413feaf19a8048605f07a17d02d83c8))

## [v1.0.3](https://github.com/limboy/soundbox/compare/v1.0.2...v1.0.3) - 2026-04-23

### Features

- persist and restore main window bounds in application state ([424eb45](https://github.com/limboy/soundbox/commit/424eb4594c93b47274c3821fab426153b63a3063))
- implement MediaSession support and global keyboard shortcuts for playback control in audio player ([8511bd1](https://github.com/limboy/soundbox/commit/8511bd1b7588580068e5ae829c2fa844c0aae803))

### Refactoring

- update context menu utility classes to use standard spacing and simplified data attributes ([d6b40aa](https://github.com/limboy/soundbox/commit/d6b40aa2ec0b2c7df9b00d09c443699e39b66462))

### Documentation

- add screenshot to README to visualize interface ([424a0dc](https://github.com/limboy/soundbox/commit/424a0dc2eee9732b5f64bee1a21930f72fe215da))
- update CHANGELOG for v1.0.2 ([0eea465](https://github.com/limboy/soundbox/commit/0eea4652f70e0d78558135e284251c8fefe0a2d4))

## [v1.0.2](https://github.com/limboy/soundbox/compare/v1.0.1...v1.0.2) - 2026-04-22

### Bug Fixes

- stop playback when creating, deleting, or switching library collections ([6bd0a42](https://github.com/limboy/soundbox/commit/6bd0a42e5f4f18770ebfdd8a31f8f22ecc08ef2e))
- restore song list scrolling and pin header to viewport top ([357c667](https://github.com/limboy/soundbox/commit/357c667e1be67ce3c70c84de05db186d91925437))

### Refactoring

- remove unused shell import from ipc/fs.ts ([7c37b91](https://github.com/limboy/soundbox/commit/7c37b9182ea4cbc3146e46791930f28bca134588))

### Documentation

- update CHANGELOG for v1.0.1 ([8f46e04](https://github.com/limboy/soundbox/commit/8f46e047c1c5f5cb5dcb93c8482615bc4facc06d))

## [v1.0.1](https://github.com/limboy/soundbox/compare/v1.0.0...v1.0.1) - 2026-04-22

### Features

- implement native context menus for collections to handle rename and delete actions via IPC ([177ec43](https://github.com/limboy/soundbox/commit/177ec434ab3bda793a540639c72fe1ea15d748f4))
- add context menu support for audio items to play files or reveal them in Finder ([8eba853](https://github.com/limboy/soundbox/commit/8eba85344bdf56ba6d94c735903e7939616c209a))

### Refactoring

- restructure player layout and fix scroll area flex alignment issues ([5d1baaa](https://github.com/limboy/soundbox/commit/5d1baaa6ea54ca377fa842fccefdf9737fc523f5))

### Documentation

- update CHANGELOG for v1.0.0 ([1cdc319](https://github.com/limboy/soundbox/commit/1cdc3191deda9c01b9e7af50ba5deaf4593aa29f))

### Styles

- update sidebar icons and collection list UI styles for improved visual consistency ([ea921c0](https://github.com/limboy/soundbox/commit/ea921c0aac90f07b9b4d66f9f2660d1964886f78))

### Other Changes

- animate sidebar collapse/expand with smooth width transition ([889df08](https://github.com/limboy/soundbox/commit/889df0822a47084f2507395a7f178c32cd8dab8f))
- update shuffle and loop transport controls with active indicator dots and refined styling ([b66b637](https://github.com/limboy/soundbox/commit/b66b6375e78c7c786073fa9f3be2fe52c79dcb4b))

## [v1.0.0](https://github.com/limboy/soundbox/releases/tag/v1.0.0) - 2026-04-22

### Features

- implement auto-update functionality with UI indicator and notarization support ([168f58a](https://github.com/limboy/soundbox/commit/168f58aa8d3938ca3e31de061ba21963809f93e3))
- enable numeric sorting for files and update audio list to display dynamic row indices ([9e6e0ac](https://github.com/limboy/soundbox/commit/9e6e0ac6f46ab20f96847034472901c9ed138961))
- add search functionality to filter audio list by title, artist, or album ([eb7cd2a](https://github.com/limboy/soundbox/commit/eb7cd2a2b053f6717f88e2dd1f8c0983f2da356d))
- add support for .ogg and .wav files and implement natural sorting by title in library collections ([fa582ac](https://github.com/limboy/soundbox/commit/fa582ac430c0b9515bce592082d913988e081f10))
- update application icon assets and add logo source file ([6a9a1dc](https://github.com/limboy/soundbox/commit/6a9a1dc92ee3235298269d0f58e9013546694702))
- add dedicated index column with active state icon to audio list ([de5dbd7](https://github.com/limboy/soundbox/commit/de5dbd75b0aa2a3d971bdc4d747b5c04759b9a86))
- expand drop zone to fill main area when dragging into collection ([5750161](https://github.com/limboy/soundbox/commit/575016146c8004da58bb3fc11bb1b80d2c7d0693))
- implement folder watching and cross-process app state synchronization ([31ddd76](https://github.com/limboy/soundbox/commit/31ddd7646f2ee6b3c3263cc968fa8d84439e7825))
- add collection rename and delete functionality with context menu support ([aa198ce](https://github.com/limboy/soundbox/commit/aa198ce74dd5d858c207da49111222f2437769f2))
- add context menu to toggle table column visibility ([ad1fb7e](https://github.com/limboy/soundbox/commit/ad1fb7e7250ab46d5a9a2dc33f86eeb6d88a0a19))
- implement three-pane layout and update player route and UI store ([dc8c684](https://github.com/limboy/soundbox/commit/dc8c684f3ddf1573c9c1f92f4d69dd70f4ea870f))
- implement responsive layout to auto-collapse sidebars on small screens ([abc4808](https://github.com/limboy/soundbox/commit/abc48089c6b5da224ac7a8eb7b37643b5f6911b9))
- improve track navigation logic to support cross-collection playback and auto-play state management ([fb8a198](https://github.com/limboy/soundbox/commit/fb8a198a81ad524842d19d3d66cf9fce48579543))
- implement bulk metadata fetching and optimize cache loading while refining theme switcher UI. ([142589b](https://github.com/limboy/soundbox/commit/142589b2167b80b5a1602d9a4f592349fea2582b))
- implement persistent file metadata caching and improve audio playback state management ([e6e3192](https://github.com/limboy/soundbox/commit/e6e3192677e151d3aed29becb85fa010087701ee))
- implement theme provider and switcher component with UI integration ([afef6dd](https://github.com/limboy/soundbox/commit/afef6dd17027355f84da6b7d5e26797e82fd0743))
- auto-remove missing files from library and sync state on window focus ([333dc11](https://github.com/limboy/soundbox/commit/333dc112210458ac3ee709c696888df388538b7c))
- add column resizing support to the audio list table ([4756420](https://github.com/limboy/soundbox/commit/47564209c7b95f00d6f7065c55bbacd7f436d4aa))
- implement column sorting for audio list using tanstack/react-table ([7d7fa47](https://github.com/limboy/soundbox/commit/7d7fa474e48b58732665e34ed8839b1359e8ecc3))
- reduce minimum window size and optimize layout responsiveness for smaller screens ([bd18943](https://github.com/limboy/soundbox/commit/bd18943eeb10c665bb4983a738eb3867f37a5d09))
- implement collection-based library management with drag-and-drop support and metadata probing ([d9c071a](https://github.com/limboy/soundbox/commit/d9c071aa0229c1deed669456bae42e46aa34279b))
- add global navigation bar with sidebar toggles and window drag support ([008faa6](https://github.com/limboy/soundbox/commit/008faa6290baf78e8c098ed5e79c3feb40f169eb))
- add hover timestamp tooltip to transport progress bar and support hiding slider thumb ([8553a29](https://github.com/limboy/soundbox/commit/8553a297633184c7da2e8b3599cac3a5671c62a6))
- redesign transport controls and implement shuffle and loop playback modes ([654d8f9](https://github.com/limboy/soundbox/commit/654d8f90444a5445aa880d50f5e32eaf3b795074))
- add drag-and-drop support for folders and audio files to the file tree component ([7d439fe](https://github.com/limboy/soundbox/commit/7d439fee6cd3fec7d5a680a5e209a7c0ef413fe6))
- implement core audio player architecture with file management, library state, and sidecar viewing components ([e64d56b](https://github.com/limboy/soundbox/commit/e64d56be67d47db03d463118a8b756d9e8228bce))
- initialize project with Electron, React, Vite, Tailwind CSS, and shadcn/ui ([79da722](https://github.com/limboy/soundbox/commit/79da722b71f9b34759d41c63f949ec4a7e842955))

### Bug Fixes

- explicitly type firstAudio as string or null in library-store.ts ([70f0f2b](https://github.com/limboy/soundbox/commit/70f0f2bdfe5ddfc92b77ae84770fd6ea8524e0b8))
- remove cursor-pointer class from audio list row elements ([4c22269](https://github.com/limboy/soundbox/commit/4c22269fabed98aa63fc5336a0c26f7013ddd7a6))
- optimize metadata loading logic and prevent redundant authorized path updates ([5f8118f](https://github.com/limboy/soundbox/commit/5f8118f8731b7b761d52573d82f229b9030b1de6))
- increase z-index of resize handle to 50 to ensure visibility over content ([92bdfd5](https://github.com/limboy/soundbox/commit/92bdfd545e8ec9dafae82af1f7186605066ace85))
- adjust sticky table header offset and remove unnecessary whitespace ([f578443](https://github.com/limboy/soundbox/commit/f5784434a3bb0d0d34abd2943dbbb3343483736e))
- prevent race conditions in lyric parsing by tracking effect activity state ([c40a1e9](https://github.com/limboy/soundbox/commit/c40a1e92488307d7da3a3533cb6fab26742a5663))
- implement custom streaming protocol for local files, improve path validation, and add audio player error handling and logging ([be2822a](https://github.com/limboy/soundbox/commit/be2822a35ee67b2e3501787cfb3323b71dbaa329))

### Refactoring

- replace Unknown artist and album placeholders with hyphens in audio list ([295eb82](https://github.com/limboy/soundbox/commit/295eb825078581606c1e527a593c2ed8f0f9b54b))
- remove unused imports in protocol and update icon styling in audio-list ([b004d71](https://github.com/limboy/soundbox/commit/b004d7110e6de5f2607ae5d508354b7019215d2b))
- remove redundant onDoubleClick handler in audio list component ([15ff5c4](https://github.com/limboy/soundbox/commit/15ff5c463ba37ee1e5b08024c87e30cab0a0fe61))
- remove artist display from transport controls and update sticky table header position ([6dda0fe](https://github.com/limboy/soundbox/commit/6dda0fe9326429fab0a8275066bb6719fcbfc202))
- update selected audio state when removing or switching collections ([95f6813](https://github.com/limboy/soundbox/commit/95f68131923abc35c42421401ec491dad8232c08))
- remove collection types to simplify library management and UI rendering ([bff5189](https://github.com/limboy/soundbox/commit/bff5189ac40edb54fb7b3f0d152120c3b18f1b7c))
- remove theme switcher component from player header ([ed23e5e](https://github.com/limboy/soundbox/commit/ed23e5e901a0115f166bc6be6a28aa0008705264))
- replace table header bottom border styling with explicit divider element for better layout control ([b469742](https://github.com/limboy/soundbox/commit/b469742966390983df2b685d65a338f6ce40b7a3))
- remove sidecar panel and layout components in favor of a simplified two-pane interface ([209a432](https://github.com/limboy/soundbox/commit/209a432f6f899191b91789481498e833096f430a))
- modernize component signatures with explicit return types and cleanup codebase style ([e6a148a](https://github.com/limboy/soundbox/commit/e6a148a6779908b7343ba2cb6aa8a4aaec8deb5a))
- update resizable handle styles and remove redundant panel borders for cleaner layout ([b51663b](https://github.com/limboy/soundbox/commit/b51663b137086d1b16132a8797f8013b0fae4da5))
- move scroll management to player route and update audio list header positioning ([7506572](https://github.com/limboy/soundbox/commit/7506572af39e38dd7716a2e12e6d10d0051d8579))
- replace root folder watcher with collection-based path authorization for local protocol access ([e128cae](https://github.com/limboy/soundbox/commit/e128caeb884f933cb1fbe00b2d25124e014c38a1))
- remove tooltips from player header and adjust layout dimensions ([bb00c01](https://github.com/limboy/soundbox/commit/bb00c018091fed48ad59206ef540a04305aa2b5e))
- fix layout overflow and improve resizable panel height consistency ([aa96ae0](https://github.com/limboy/soundbox/commit/aa96ae0b11b5eb6afc175df6f5fb5ca4a20dcee2))

### Documentation

- update project README and remove unused tooltip components from update indicator ([8a0a1c8](https://github.com/limboy/soundbox/commit/8a0a1c8fea94885cb08d600dc909a3183ca041e3))

### Styles

- reduce header height from 11 to 10 in player route ([56f70c7](https://github.com/limboy/soundbox/commit/56f70c7a76b7cd886350c7ef4ea737d98030e3a6))
- update audio list header to use muted background with backdrop blur ([6429b40](https://github.com/limboy/soundbox/commit/6429b4046600c2cb2dd17e3a6cc1e025e24044d5))
- implement global custom scrollbar and refine scroll-area component styling ([fd7ce8b](https://github.com/limboy/soundbox/commit/fd7ce8becd17c43c5402a00adc8781ab133f3d28))

### Build

- replace electron-builder.yml with inline config and enable notarization ([2c62235](https://github.com/limboy/soundbox/commit/2c6223579a448824d97cab9dc151316cbe157fb8))

### CI

- add automated release workflow with CHANGELOG generation support ([edecedf](https://github.com/limboy/soundbox/commit/edecedfec4900793f80719ad4bb3851835ead5d9))

### Chores

- enable notarization for macOS builds in package.json ([a05f4a7](https://github.com/limboy/soundbox/commit/a05f4a7a6334be63ea571c31e4ce9fc479b1c930))
- disable notarization and add debug and ms dependencies ([bd286ce](https://github.com/limboy/soundbox/commit/bd286ce3c08bb4a8f5d58478ed84de906809afba))
- ignore and untrack tsbuildinfo files ([6f72cfe](https://github.com/limboy/soundbox/commit/6f72cfee04eda05d484401237bb75724f965aba9))
