import CoreServices
import Foundation

/// Reports file-level changes under a set of folders, via FSEvents.
final class FolderWatcher {
    var onChange: ([String]) -> Void = { _ in }

    private var stream: FSEventStreamRef?
    private var paths: [String] = []

    /// Starts watching exactly these folders; a no-op when they haven't changed.
    func watch(_ folders: [String]) {
        let folders = Array(Set(folders)).sorted()
        guard folders != paths else { return }
        paths = folders
        stop()
        guard !folders.isEmpty else { return }

        var context = FSEventStreamContext(
            version: 0, info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil, release: nil, copyDescription: nil
        )
        let flags = kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes
            | kFSEventStreamCreateFlagWatchRoot
        guard let stream = FSEventStreamCreate(
            nil, folderWatcherCallback, &context, folders as CFArray,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.5, FSEventStreamCreateFlags(flags)
        ) else { return }
        FSEventStreamSetDispatchQueue(stream, .main)
        FSEventStreamStart(stream)
        self.stream = stream
    }

    func stop() {
        guard let stream else { return }
        FSEventStreamStop(stream)
        FSEventStreamInvalidate(stream)
        FSEventStreamRelease(stream)
        self.stream = nil
    }

    isolated deinit { stop() }

    fileprivate func receive(_ paths: [String]) { onChange(paths) }
}

// A plain C callback; the stream is scheduled on the main queue.
nonisolated private func folderWatcherCallback(
    _ stream: ConstFSEventStreamRef, _ info: UnsafeMutableRawPointer?, _ count: Int,
    _ eventPaths: UnsafeMutableRawPointer, _ flags: UnsafePointer<FSEventStreamEventFlags>,
    _ ids: UnsafePointer<FSEventStreamEventId>
) {
    guard let info else { return }
    let paths = (Unmanaged<CFArray>.fromOpaque(eventPaths).takeUnretainedValue() as? [String]) ?? []
    let watcher = Unmanaged<FolderWatcher>.fromOpaque(info).takeUnretainedValue()
    MainActor.assumeIsolated { watcher.receive(paths) }
}
