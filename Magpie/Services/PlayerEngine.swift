import AVFoundation
import AppKit
import MediaPlayer
import Observation

@Observable
final class PlayerEngine {
    private(set) var currentPath: String?
    private(set) var isPlaying = false
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval = 0
    /// The play order — the source list, shuffled when shuffle is on.
    private(set) var queue: [String] = []

    var volume: Double {
        didSet {
            player.volume = Float(volume)
            UserDefaults.standard.set(volume, forKey: "volume")
        }
    }
    var isMuted = false { didSet { player.isMuted = isMuted } }
    var shuffle: Bool {
        didSet {
            UserDefaults.standard.set(shuffle, forKey: "shuffle")
            rebuildQueue()
            preloadNext()
        }
    }
    var repeatMode: RepeatMode {
        didSet {
            UserDefaults.standard.set(repeatMode.rawValue, forKey: "repeatMode")
            preloadNext()
        }
    }

    let library: LibraryStore

    @ObservationIgnored private let player = AVQueuePlayer()
    /// The item for `currentPath`. The player may already have moved past it
    /// by the time we hear it finished.
    @ObservationIgnored private var playingItem: AVPlayerItem?
    /// The next track, queued behind the current one so it starts without a gap.
    @ObservationIgnored private var upcoming: (item: AVPlayerItem, path: String)?
    @ObservationIgnored private var sourceQueue: [String] = []
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var isSeeking = false
    @ObservationIgnored private var lastPositionSave = Date.distantPast
    @ObservationIgnored private var artworkTask: Task<Void, Never>?

    /// Tracks at least this long remember where you left off (audiobooks, podcasts, mixes).
    private static let resumableDuration: TimeInterval = 10 * 60

    init(library: LibraryStore) {
        self.library = library
        let defaults = UserDefaults.standard
        volume = defaults.object(forKey: "volume") as? Double ?? 1
        shuffle = defaults.bool(forKey: "shuffle")
        repeatMode = RepeatMode(rawValue: defaults.string(forKey: "repeatMode") ?? "") ?? .off
        player.volume = Float(volume)
        player.actionAtItemEnd = .advance

        observeTime()
        observeNotifications()
        configureRemoteCommands()
        restore()
    }

    var currentTrack: Track? { currentPath.map(library.track(for:)) }

    // MARK: Transport

    func play(_ path: String, in list: [String]) {
        sourceQueue = list.contains(path) ? list : [path]
        rebuildQueue(startingWith: path)
        load(path, autoplay: true, startAt: resumePoint(for: path))
    }

    func togglePlayPause() {
        if isPlaying { pause() } else { resume() }
    }

    func resume() {
        guard currentPath != nil else {
            if let first = queue.first ?? library.paths(for: library.selection).first {
                play(first, in: library.paths(for: library.selection))
            }
            return
        }
        player.play()
        isPlaying = true
        updateNowPlayingTime()
    }

    func pause() {
        player.pause()
        isPlaying = false
        savePosition(force: true)
        updateNowPlayingTime()
    }

    func next() { advance(by: 1, automatic: false) }

    func previous() {
        if currentTime > 3 { seek(to: 0) } else { advance(by: -1, automatic: false) }
    }

    func skip(by seconds: TimeInterval) {
        seek(to: min(max(0, currentTime + seconds), max(0, duration - 0.5)))
    }

    func seek(to time: TimeInterval) {
        guard player.currentItem != nil else { return }
        isSeeking = true
        currentTime = time
        player.seek(to: CMTime(seconds: time, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor in
                self?.isSeeking = false
                self?.updateNowPlayingTime()
            }
        }
    }

    func adjustVolume(by delta: Double) {
        isMuted = false
        volume = min(1, max(0, volume + delta))
    }

    // MARK: Queue

    private func rebuildQueue(startingWith start: String? = nil) {
        let anchor = start ?? currentPath
        guard shuffle else {
            queue = sourceQueue
            return
        }
        var shuffled = sourceQueue.shuffled()
        if let anchor, let index = shuffled.firstIndex(of: anchor) {
            shuffled.swapAt(0, index)
        }
        queue = shuffled
    }

    /// The track that plays when the current one ends on its own, if any.
    private var nextPath: String? {
        guard let current = currentPath else { return nil }
        if repeatMode == .one { return current }
        guard let index = queue.firstIndex(of: current) else { return nil }
        if index + 1 < queue.count { return queue[index + 1] }
        return repeatMode == .all ? queue.first : nil
    }

    /// Queues the next track behind the current one, replacing whatever was queued.
    private func preloadNext() {
        if let upcoming {
            player.remove(upcoming.item)
            self.upcoming = nil
        }
        // Tracks that resume mid-way load when they start instead.
        guard let playingItem, player.items().contains(playingItem),
              let path = nextPath, resumePoint(for: path) == nil else { return }
        let item = AVPlayerItem(url: URL(fileURLWithPath: path))
        player.insert(item, after: playingItem)
        upcoming = (item, path)
    }

    private func advance(by step: Int, automatic: Bool) {
        guard let current = currentPath, !queue.isEmpty else { return }
        let index = queue.firstIndex(of: current) ?? -1
        var target = index + step
        if target >= queue.count {
            guard repeatMode == .all || !automatic else {
                // End of the queue: stop on the last track, rewound.
                load(current, autoplay: false)
                return
            }
            target = 0
        } else if target < 0 {
            target = queue.count - 1
        }
        load(queue[target], autoplay: automatic || isPlaying, startAt: resumePoint(for: queue[target]))
    }

    private func load(_ path: String, autoplay: Bool, startAt: TimeInterval? = nil) {
        savePosition(force: true)
        currentPath = path
        library.lastTrackPath = path
        let item = AVPlayerItem(url: URL(fileURLWithPath: path))
        player.removeAllItems()
        upcoming = nil
        player.insert(item, after: nil)
        playingItem = item
        currentTime = startAt ?? 0
        duration = library.track(for: path).duration
        if let startAt, startAt > 0 {
            player.seek(to: CMTime(seconds: startAt, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        }
        if autoplay { player.play() }
        isPlaying = autoplay
        preloadNext()
        trackDidStart()
    }

    /// The player moved on to the queued track by itself; catch up with it.
    private func adoptUpcoming() {
        guard let upcoming else { return }
        self.upcoming = nil
        currentPath = upcoming.path
        library.lastTrackPath = upcoming.path
        playingItem = upcoming.item
        currentTime = 0
        duration = library.track(for: upcoming.path).duration
        preloadNext()
        trackDidStart()
    }

    private func trackDidStart() {
        guard let path = currentPath else { return }
        updateNowPlaying()
        // Ready the player backdrop's colors before anyone opens it.
        Task { _ = await ArtworkCache.shared.palette(path) }
        // And its lyrics, so the player shows them as it slides in.
        let track = library.track(for: path)
        if track.duration > 0 { Task { _ = await LyricsCache.shared.load(track) } }
    }

    private func resumePoint(for path: String) -> TimeInterval? {
        let track = library.track(for: path)
        guard track.duration >= Self.resumableDuration, let position = library.position(path),
              position > 5, position < track.duration - 10 else { return nil }
        return position
    }

    /// Reopens the last track, paused, where it was left.
    private func restore() {
        guard let path = library.lastTrackPath, FileManager.default.fileExists(atPath: path) else { return }
        let list = library.paths(for: library.selection)
        sourceQueue = list.contains(path) ? list : [path]
        rebuildQueue(startingWith: path)
        load(path, autoplay: false, startAt: library.position(path))
    }

    private func savePosition(force: Bool = false) {
        guard let path = currentPath else { return }
        guard force || Date().timeIntervalSince(lastPositionSave) > 5 else { return }
        lastPositionSave = Date()
        library.setPosition(currentTime > 1 ? currentTime : nil, for: path)
    }

    // MARK: Observation

    private func observeTime() {
        let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            MainActor.assumeIsolated { self?.tick(time.seconds) }
        }
    }

    private func tick(_ seconds: TimeInterval) {
        // Between the player moving on and us hearing about it, times belong to the next track.
        guard player.currentItem === playingItem else { return }
        if !isSeeking, seconds.isFinite { currentTime = seconds }
        if let itemDuration = playingItem?.duration.seconds, itemDuration.isFinite, itemDuration > 0,
           abs(itemDuration - duration) > 0.5 {
            duration = itemDuration
            updateNowPlaying()
        }
        if isPlaying { savePosition() }
    }

    private func observeNotifications() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: nil, queue: .main) { [weak self] note in
            let item = note.object as? AVPlayerItem
            MainActor.assumeIsolated {
                guard let self, item === self.playingItem else { return }
                self.itemDidFinish()
            }
        })
        observers.append(center.addObserver(forName: AVPlayerItem.failedToPlayToEndTimeNotification, object: nil, queue: .main) { [weak self] note in
            let item = note.object as? AVPlayerItem
            MainActor.assumeIsolated {
                guard let self, item === self.playingItem else { return }
                self.advance(by: 1, automatic: true)
            }
        })
        observers.append(center.addObserver(forName: AVPlayer.rateDidChangeNotification, object: player, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                // Catches pauses we didn't ask for, like an audio route change.
                if self.player.rate == 0, self.player.timeControlStatus == .paused, self.isPlaying,
                   self.player.currentItem?.status == .readyToPlay, self.currentTime < self.duration - 1 {
                    self.isPlaying = false
                    self.updateNowPlayingTime()
                }
            }
        })
        observers.append(center.addObserver(forName: NSApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.savePosition(force: true)
                self?.library.saveNow()
            }
        })
    }

    private func itemDidFinish() {
        guard let path = currentPath else { return }
        library.recordPlay(path)
        library.setPosition(nil, for: path)
        currentTime = 0
        // The queued track is already playing, unless it failed to load and was dropped.
        if let upcoming, player.items().contains(upcoming.item) {
            adoptUpcoming()
        } else if repeatMode == .one {
            load(path, autoplay: true)
        } else {
            advance(by: 1, automatic: true)
        }
    }

    // MARK: Now Playing

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        Self.handle(center.playCommand) { [weak self] in self?.resume() }
        Self.handle(center.pauseCommand) { [weak self] in self?.pause() }
        Self.handle(center.togglePlayPauseCommand) { [weak self] in self?.togglePlayPause() }
        Self.handle(center.nextTrackCommand) { [weak self] in self?.next() }
        Self.handle(center.previousTrackCommand) { [weak self] in self?.previous() }
        Self.handleSeek(center.changePlaybackPositionCommand) { [weak self] time in self?.seek(to: time) }
    }

    // Built outside the main actor so the handlers aren't main-actor isolated:
    // MediaPlayer may call them from any thread.
    nonisolated private static func handle(_ command: MPRemoteCommand, _ action: @escaping @MainActor @Sendable () -> Void) {
        command.addTarget { _ in
            Task { @MainActor in action() }
            return .success
        }
    }

    nonisolated private static func handleSeek(_ command: MPChangePlaybackPositionCommand, _ action: @escaping @MainActor @Sendable (TimeInterval) -> Void) {
        command.addTarget { event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let time = event.positionTime
            Task { @MainActor in action(time) }
            return .success
        }
    }

    nonisolated private static func artwork(_ image: SendableImage) -> MPMediaItemArtwork {
        let size = CGSize(width: image.cgImage.width, height: image.cgImage.height)
        return MPMediaItemArtwork(boundsSize: size) { _ in NSImage(cgImage: image.cgImage, size: size) }
    }

    private func updateNowPlaying() {
        guard let track = currentTrack else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyAlbumTitle: track.album,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
        if let existing = MPNowPlayingInfoCenter.default().nowPlayingInfo,
           existing[MPMediaItemPropertyTitle] as? String == track.title,
           let art = existing[MPMediaItemPropertyArtwork] {
            info[MPMediaItemPropertyArtwork] = art
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused

        let path = track.path
        artworkTask?.cancel()
        artworkTask = Task {
            guard let image = await MetadataReader.artwork(path: path, maxPixel: 600),
                  !Task.isCancelled, path == currentPath else { return }
            MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyArtwork] = Self.artwork(image)
        }
    }

    private func updateNowPlayingTime() {
        let center = MPNowPlayingInfoCenter.default()
        center.nowPlayingInfo?[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        center.nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        center.playbackState = isPlaying ? .playing : .paused
    }
}
