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
    /// Songs added with Play Next or Add to Queue. They play, in order, before
    /// the queue carries on.
    private(set) var upNext: [QueueEntry] = [] {
        didSet { UserDefaults.standard.set(upNext.map(\.path), forKey: "upNext") }
    }

    var volume: Double {
        didSet {
            player.volume = Float(volume)
            UserDefaults.standard.set(volume, forKey: "volume")
        }
    }
    var isMuted = false { didSet { player.isMuted = isMuted } }
    /// Playback speed, for every song. Pitch stays where it was.
    var rate: Float {
        didSet {
            UserDefaults.standard.set(rate, forKey: "playbackRate")
            player.defaultRate = rate
            if isPlaying { player.rate = rate }
            updateNowPlayingTime()
        }
    }
    static let rates: [Float] = [0.5, 0.75, 1, 1.25, 1.5, 2]
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
    @ObservationIgnored private var upcoming: (item: AVPlayerItem, path: String, fromUpNext: Bool)?
    /// The queue's place: the last song it played. Songs from Up Next don't move it.
    @ObservationIgnored private var queuePath: String?
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
        rate = defaults.object(forKey: "playbackRate") as? Float ?? 1
        player.volume = Float(volume)
        // play() starts at this rate.
        player.defaultRate = rate
        player.actionAtItemEnd = .advance
        upNext = (defaults.stringArray(forKey: "upNext") ?? [])
            .filter { FileManager.default.fileExists(atPath: $0) }
            .map { QueueEntry(path: $0) }

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
        queuePath = path
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

    /// The queue's songs after its place, wrapping round when repeating all.
    var queueAhead: [String] {
        guard let index = queuePath.flatMap(queue.firstIndex(of:)) else { return queue }
        var ahead = Array(queue[(index + 1)...])
        if repeatMode == .all { ahead += queue[...index] }
        return ahead
    }

    /// The track that plays when the current one ends on its own, if any.
    private var nextUp: (path: String, fromUpNext: Bool)? {
        guard let current = currentPath else { return nil }
        if repeatMode == .one { return (current, false) }
        if let entry = upNext.first { return (entry.path, true) }
        return queueAhead.first.map { ($0, false) }
    }

    // MARK: Up Next

    func playNext(_ paths: [String]) { enqueue(paths, atFront: true) }

    func addToQueue(_ paths: [String]) { enqueue(paths, atFront: false) }

    private func enqueue(_ paths: [String], atFront: Bool) {
        var entries = paths.map { QueueEntry(path: $0) }
        // With nothing loaded, the first one plays right away.
        let first = currentPath == nil && !entries.isEmpty ? entries.removeFirst() : nil
        upNext.insert(contentsOf: entries, at: atFront ? 0 : upNext.count)
        if let first {
            play(first.path, in: [first.path])
        } else {
            preloadNext()
        }
    }

    func removeFromUpNext(_ ids: Set<QueueEntry.ID>) {
        upNext.removeAll { ids.contains($0.id) }
        preloadNext()
    }

    func moveUpNext(from source: IndexSet, to destination: Int) {
        upNext.move(fromOffsets: source, toOffset: destination)
        preloadNext()
    }

    func clearUpNext() {
        upNext.removeAll()
        preloadNext()
    }

    /// Plays a song from Up Next, skipping the ones before it.
    func playFromUpNext(_ id: QueueEntry.ID) {
        guard let index = upNext.firstIndex(where: { $0.id == id }) else { return }
        let path = upNext[index].path
        upNext.removeFirst(index + 1)
        load(path, autoplay: true, startAt: resumePoint(for: path))
    }

    /// Jumps to a song further along the queue.
    func playFromQueue(_ path: String) {
        guard queue.contains(path) else { return }
        queuePath = path
        load(path, autoplay: true, startAt: resumePoint(for: path))
    }

    /// Queues the next track behind the current one, replacing whatever was queued.
    private func preloadNext() {
        if let upcoming {
            player.remove(upcoming.item)
            self.upcoming = nil
        }
        // Tracks that resume mid-way load when they start instead.
        guard let playingItem, player.items().contains(playingItem),
              let (path, fromUpNext) = nextUp, resumePoint(for: path) == nil else { return }
        let item = Self.makeItem(path)
        player.insert(item, after: playingItem)
        upcoming = (item, path, fromUpNext)
    }

    private func advance(by step: Int, automatic: Bool) {
        guard let current = currentPath else { return }
        if step > 0, let entry = upNext.first {
            upNext.removeFirst()
            load(entry.path, autoplay: automatic || isPlaying, startAt: resumePoint(for: entry.path))
            return
        }
        guard !queue.isEmpty else { return }
        let index = queuePath.flatMap(queue.firstIndex(of:)) ?? -1
        // Back from a song out of Up Next returns to the queue's place.
        var target = step < 0 && current != queuePath && index >= 0 ? index : index + step
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
        queuePath = queue[target]
        load(queue[target], autoplay: automatic || isPlaying, startAt: resumePoint(for: queue[target]))
    }

    private func load(_ path: String, autoplay: Bool, startAt: TimeInterval? = nil) {
        savePosition(force: true)
        currentPath = path
        library.lastTrackPath = path
        let item = Self.makeItem(path)
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

    private static func makeItem(_ path: String) -> AVPlayerItem {
        let item = AVPlayerItem(url: URL(fileURLWithPath: path))
        // The best quality for music when the speed isn't 1×.
        item.audioTimePitchAlgorithm = .spectral
        return item
    }

    /// The player moved on to the queued track by itself; catch up with it.
    private func adoptUpcoming() {
        guard let upcoming else { return }
        self.upcoming = nil
        if upcoming.fromUpNext {
            upNext.removeFirst()
        } else if upcoming.path != currentPath {
            queuePath = upcoming.path
        }
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
        queuePath = path
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
        center.changePlaybackRateCommand.supportedPlaybackRates = Self.rates.map { NSNumber(value: $0) }
        Self.handleRate(center.changePlaybackRateCommand) { [weak self] rate in self?.rate = rate }
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

    nonisolated private static func handleRate(_ command: MPChangePlaybackRateCommand, _ action: @escaping @MainActor @Sendable (Float) -> Void) {
        command.addTarget { event in
            guard let event = event as? MPChangePlaybackRateCommandEvent else { return .commandFailed }
            let rate = event.playbackRate
            Task { @MainActor in action(rate) }
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
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? Double(rate) : 0.0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: Double(rate),
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
        center.nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? Double(rate) : 0.0
        center.nowPlayingInfo?[MPNowPlayingInfoPropertyDefaultPlaybackRate] = Double(rate)
        center.playbackState = isPlaying ? .playing : .paused
    }
}
