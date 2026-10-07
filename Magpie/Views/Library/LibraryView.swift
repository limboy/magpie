import SwiftUI

struct LibraryView: View {
    let split: LibrarySplitController

    var body: some View {
        // Under the toolbar, as a split view is: each pane insets itself.
        LibrarySplitView(controller: split)
            .ignoresSafeArea()
    }
}
