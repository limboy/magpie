import Foundation
import Observation
import Sparkle

/// Sparkle's standard updater. It reads the feed and public key from
/// Info.plist, checks in the background (Release builds only, see
/// SUEnableAutomaticChecks), and shows its own windows for the rest.
@Observable
final class Updater {
    private(set) var canCheckForUpdates = false

    @ObservationIgnored private let controller = SPUStandardUpdaterController(
        startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil
    )
    @ObservationIgnored private var observation: NSKeyValueObservation?

    init() {
        observation = controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] updater, _ in
            let canCheck = updater.canCheckForUpdates
            MainActor.assumeIsolated { self?.canCheckForUpdates = canCheck }
        }
    }

    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }
}
