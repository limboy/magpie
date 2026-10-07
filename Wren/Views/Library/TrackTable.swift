import AppKit
import SwiftUI

enum TrackMenuEntry {
    case item(String, () -> Void)
    case separator
}

/// The song list as a native NSTableView. SwiftUI's `Table` hosts every cell
/// as its own SwiftUI view and measures row heights while scrolling, which
/// stutters with a few hundred songs; plain reused AppKit cells don't.
struct TrackTable: NSViewRepresentable {
    let rows: [TrackRow]
    let currentPath: String?
    let isPlaying: Bool
    @Binding var selection: Set<String>
    let sortKey: SortKey
    let sortAscending: Bool
    let onSort: (SortKey, Bool) -> Void
    let onPlay: (String) -> Void
    let onToggleFavorite: (String) -> Void
    let menu: (Set<String>) -> [TrackMenuEntry]

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSScrollView {
        let table = TrackNSTableView()
        table.style = .inset
        table.rowHeight = 26
        table.usesAutomaticRowHeights = false
        table.usesAlternatingRowBackgroundColors = true
        table.allowsMultipleSelection = true
        table.allowsColumnReordering = true
        table.allowsColumnResizing = true
        table.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        table.intercellSpacing = NSSize(width: 8, height: 0)

        for column in TrackColumn.allCases {
            let tableColumn = NSTableColumn(identifier: column.identifier)
            tableColumn.title = column.title
            tableColumn.width = column.width
            tableColumn.minWidth = column.minWidth
            tableColumn.maxWidth = column.maxWidth
            if let key = column.sortKey {
                tableColumn.sortDescriptorPrototype = NSSortDescriptor(key: key.rawValue, ascending: true)
            }
            if column == .favorite {
                tableColumn.headerCell.attributedStringValue = Self.symbolTitle("star")
            }
            tableColumn.headerCell.alignment = column.alignment
            table.addTableColumn(tableColumn)
        }
        table.autosaveName = "TrackTable"
        table.autosaveTableColumns = true

        let coordinator = context.coordinator
        coordinator.table = table
        table.dataSource = coordinator
        table.delegate = coordinator
        table.target = coordinator
        table.action = #selector(Coordinator.clicked)
        table.doubleAction = #selector(Coordinator.doubleClicked)
        table.onReturn = { [weak coordinator] in coordinator?.playSelection() }
        let menu = NSMenu()
        menu.delegate = coordinator
        table.menu = menu

        let scrollView = TrackScrollView()
        scrollView.documentView = table
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        coordinator.update(self)
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        context.coordinator.update(self)
    }

    private static func symbolTitle(_ name: String) -> NSAttributedString {
        let attachment = NSTextAttachment()
        attachment.image = NSImage(systemSymbolName: name, accessibilityDescription: "Favorite")
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        let title = NSMutableAttributedString(attachment: attachment)
        title.addAttribute(.paragraphStyle, value: paragraph, range: NSRange(location: 0, length: title.length))
        return title
    }

    // MARK: Coordinator

    final class Coordinator: NSObject, NSTableViewDataSource, NSTableViewDelegate, NSMenuDelegate {
        weak var table: NSTableView?
        private var parent: TrackTable?
        private var rows: [TrackRow] = []
        private var rowIndex: [String: Int] = [:]
        private var currentPath: String?
        private var isPlaying = false
        /// Set while pushing SwiftUI state into the table, so the delegate
        /// callbacks it triggers aren't echoed back.
        private var isSyncing = false

        func update(_ parent: TrackTable) {
            self.parent = parent
            guard let table else { return }
            isSyncing = true
            defer { isSyncing = false }

            if parent.rows != rows {
                rows = parent.rows
                rowIndex = Dictionary(rows.enumerated().map { ($1.id, $0) }, uniquingKeysWith: { first, _ in first })
                currentPath = parent.currentPath
                isPlaying = parent.isPlaying
                table.reloadData()
            } else if parent.currentPath != currentPath || parent.isPlaying != isPlaying {
                let affected = IndexSet([currentPath, parent.currentPath].compactMap { $0.flatMap { rowIndex[$0] } })
                currentPath = parent.currentPath
                isPlaying = parent.isPlaying
                table.reloadData(forRowIndexes: affected, columnIndexes: IndexSet(integersIn: 0..<table.numberOfColumns))
            }

            let descriptors = [NSSortDescriptor(key: parent.sortKey.rawValue, ascending: parent.sortAscending)]
            if table.sortDescriptors != descriptors { table.sortDescriptors = descriptors }

            let wanted = IndexSet(parent.selection.compactMap { rowIndex[$0] })
            if wanted != table.selectedRowIndexes {
                table.selectRowIndexes(wanted, byExtendingSelection: false)
            }
        }

        // MARK: Data

        func numberOfRows(in tableView: NSTableView) -> Int { rows.count }

        func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
            guard let tableColumn, let column = TrackColumn(rawValue: tableColumn.identifier.rawValue),
                  rows.indices.contains(row) else { return nil }
            let cell = tableView.makeView(withIdentifier: column.identifier, owner: nil) as? TrackCellView
                ?? TrackCellView(column: column)
            let item = rows[row]
            cell.configure(item, isCurrent: item.id == currentPath, isPlaying: isPlaying)
            return cell
        }

        // MARK: Interaction

        func tableViewSelectionDidChange(_ notification: Notification) {
            guard !isSyncing, let table else { return }
            let ids = Set(table.selectedRowIndexes.compactMap { rows.indices.contains($0) ? rows[$0].id : nil })
            if ids != parent?.selection { parent?.selection = ids }
        }

        func tableView(_ tableView: NSTableView, sortDescriptorsDidChange oldDescriptors: [NSSortDescriptor]) {
            guard !isSyncing, let first = tableView.sortDescriptors.first,
                  let key = first.key.flatMap(SortKey.init(rawValue:)) else { return }
            parent?.onSort(key, first.ascending)
        }

        @objc func clicked() {
            guard let table, rows.indices.contains(table.clickedRow), table.clickedColumn >= 0,
                  table.tableColumns[table.clickedColumn].identifier == TrackColumn.favorite.identifier else { return }
            parent?.onToggleFavorite(rows[table.clickedRow].id)
        }

        @objc func doubleClicked() {
            guard let table, rows.indices.contains(table.clickedRow) else { return }
            parent?.onPlay(rows[table.clickedRow].id)
        }

        func playSelection() {
            guard let table, let first = table.selectedRowIndexes.first, rows.indices.contains(first) else { return }
            parent?.onPlay(rows[first].id)
        }

        // MARK: Context menu

        @objc private func runMenuItem(_ item: NSMenuItem) {
            (item.representedObject as? MenuAction)?.run()
        }

        func menuNeedsUpdate(_ menu: NSMenu) {
            menu.removeAllItems()
            guard let table, let parent, rows.indices.contains(table.clickedRow) else { return }
            // Right-clicking outside the selection acts on that row alone.
            let ids: Set<String> = table.selectedRowIndexes.contains(table.clickedRow)
                ? Set(table.selectedRowIndexes.compactMap { rows.indices.contains($0) ? rows[$0].id : nil })
                : [rows[table.clickedRow].id]
            for entry in parent.menu(ids) {
                switch entry {
                case .separator: menu.addItem(.separator())
                case .item(let title, let action):
                    let item = NSMenuItem(title: title, action: #selector(runMenuItem(_:)), keyEquivalent: "")
                    item.target = self
                    item.representedObject = MenuAction(action)
                    menu.addItem(item)
                }
            }
        }
    }
}

// MARK: - Columns

enum TrackColumn: String, CaseIterable {
    case number, title, artist, album, plays, time, favorite

    var identifier: NSUserInterfaceItemIdentifier { NSUserInterfaceItemIdentifier(rawValue) }

    var title: String {
        switch self {
        case .number: "#"
        case .title: "Title"
        case .artist: "Artist"
        case .album: "Album"
        case .plays: "Plays"
        case .time: "Time"
        case .favorite: ""
        }
    }

    var sortKey: SortKey? {
        switch self {
        case .number: .order
        case .title: .title
        case .artist: .artist
        case .album: .album
        case .plays: .plays
        case .time: .duration
        case .favorite: nil
        }
    }

    var width: CGFloat {
        switch self {
        case .number: 34
        case .title: 280
        case .artist, .album: 180
        case .plays: 44
        case .time: 52
        case .favorite: 22
        }
    }

    var minWidth: CGFloat {
        switch self {
        case .title: 120
        case .artist, .album: 80
        default: width
        }
    }

    var maxWidth: CGFloat {
        switch self {
        case .title, .artist, .album: 2000
        default: width
        }
    }

    var alignment: NSTextAlignment {
        switch self {
        case .number, .plays, .time: .right
        case .favorite: .center
        default: .left
        }
    }
}

// MARK: - Cells

final class TrackCellView: NSTableCellView {
    private let column: TrackColumn
    private let label = NSTextField(labelWithString: "")
    private let symbol = NSImageView()

    init(column: TrackColumn) {
        self.column = column
        super.init(frame: .zero)
        identifier = column.identifier

        label.lineBreakMode = .byTruncatingTail
        label.alignment = column.alignment
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        textField = label

        symbol.translatesAutoresizingMaskIntoConstraints = false
        symbol.symbolConfiguration = .init(pointSize: 12, weight: .regular)
        addSubview(symbol)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            symbol.centerYAnchor.constraint(equalTo: centerYAnchor),
            column == .number
                ? symbol.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2)
                : symbol.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private static let regular = NSFont.systemFont(ofSize: 13)
    private static let semibold = NSFont.systemFont(ofSize: 13, weight: .semibold)
    private static let digits = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular)

    func configure(_ row: TrackRow, isCurrent: Bool, isPlaying: Bool) {
        symbol.removeAllSymbolEffects()
        symbol.isHidden = true
        label.isHidden = false
        label.font = Self.regular
        label.textColor = .secondaryLabelColor

        switch column {
        case .number:
            if isCurrent {
                label.isHidden = true
                symbol.isHidden = false
                symbol.image = NSImage(systemSymbolName: "speaker.wave.2.fill", accessibilityDescription: "Now Playing")
                symbol.contentTintColor = .controlAccentColor
                if isPlaying { symbol.addSymbolEffect(.variableColor.iterative.dimInactiveLayers) }
            } else {
                label.font = Self.digits
                label.textColor = .tertiaryLabelColor
                label.stringValue = "\(row.order + 1)"
            }
        case .title:
            label.stringValue = row.title
            label.font = isCurrent ? Self.semibold : Self.regular
            label.textColor = isCurrent ? .controlAccentColor : .labelColor
        case .artist:
            label.stringValue = row.artist
        case .album:
            label.stringValue = row.album
        case .plays:
            label.font = Self.digits
            label.stringValue = row.plays > 0 ? "\(row.plays)" : ""
        case .time:
            label.font = Self.digits
            label.stringValue = row.duration > 0 ? formatTime(row.duration) : ""
        case .favorite:
            label.isHidden = true
            symbol.isHidden = false
            symbol.image = NSImage(
                systemSymbolName: row.isFavorite ? "star.fill" : "star",
                accessibilityDescription: row.isFavorite ? "Unfavorite" : "Favorite"
            )
            symbol.contentTintColor = row.isFavorite ? .controlAccentColor : .tertiaryLabelColor
        }
    }
}

/// Keeps every column visible: when the columns add up to more than the
/// visible width (first layout, restored widths, a narrower window), they
/// shrink to fit instead of running off the right edge.
final class TrackScrollView: NSScrollView {
    override func tile() {
        super.tile()
        guard let table = documentView as? NSTableView else { return }
        if table.frame.width > contentView.bounds.width + 1, contentView.bounds.width > 0 {
            table.sizeToFit()
        }
    }
}

final class TrackNSTableView: NSTableView {
    var onReturn: () -> Void = {}

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 36 || event.keyCode == 76 {
            onReturn()
        } else {
            super.keyDown(with: event)
        }
    }
}

/// Carries a menu item's closure as its `representedObject`.
private final class MenuAction: NSObject {
    let run: () -> Void
    init(_ run: @escaping () -> Void) { self.run = run }
}
