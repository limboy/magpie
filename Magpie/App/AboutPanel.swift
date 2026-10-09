import AppKit
import SwiftUI

/// The "About Magpie" menu item, opening Magpie's own About window in place of the
/// standard panel, whose credits box is too small to hold a License and a
/// Credits section comfortably.
struct AboutCommand: Commands {
    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            AboutMenuItem()
        }
    }
}

/// `openWindow` is only in reach from a view, not from the commands
/// themselves.
private struct AboutMenuItem: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("About Magpie") {
            openWindow(id: AboutWindow.id)
        }
    }
}

/// The About window: one of it, a fixed size, and never restored at launch.
struct AboutWindow: Scene {
    static let id = "about"

    var body: some Scene {
        Window("About Magpie", id: Self.id) {
            AboutView()
                .windowMinimizeBehavior(.disabled)
        }
        .windowResizability(.contentSize)
        .windowStyle(.hiddenTitleBar)
        .restorationBehavior(.disabled)
        .defaultLaunchBehavior(.suppressed)
        .defaultPosition(.center)
        .handlesExternalEvents(matching: [])
    }
}

private struct AboutView: View {
    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.top, 28)
                .padding(.bottom, 20)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    section("License") { LicenseCard() }
                    section("Credits") { CreditsCard() }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 20)
            }
            .scrollIndicators(.never)
            .scrollEdgeEffectStyle(.soft, for: .top)

            Divider()
            footer
                .padding(.vertical, 12)
        }
        .frame(width: 400, height: 620)
        .containerBackground(.thickMaterial, for: .window)
    }

    private var header: some View {
        VStack(spacing: 6) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 96, height: 96)
                .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
            Text("Magpie")
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .padding(.top, 4)
            Text("Version \(Self.version)")
                .font(.callout)
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .textSelection(.enabled)
        }
    }

    private var footer: some View {
        HStack(spacing: 4) {
            Text("Copyright © 2026")
            Link("Limboy", destination: URL(string: "https://limboy.me")!)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .kerning(0.6)
                .padding(.leading, 4)
            content()
        }
    }

    private static var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(short) (\(build))"
    }
}

/// A rounded panel the sections sit in, a shade off the window behind it.
private struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.separator.opacity(0.5)))
    }
}

private struct LicenseCard: View {
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.title2)
                        .foregroundStyle(.tint)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("MIT License")
                            .font(.headline)
                        Text("Free and open-source software")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Text("You are free to use, copy, modify, and distribute Magpie, including commercially. Keep the copyright and permission notices with copies or substantial portions.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    LinkButton("Read License", systemImage: "doc.text",
                               url: "https://github.com/limboy/magpie/blob/main/LICENSE")
                    LinkButton("Source Code", systemImage: "chevron.left.forwardslash.chevron.right",
                               url: "https://github.com/limboy/magpie")
                }
            }
            .padding(14)
        }
    }
}

private struct LinkButton: View {
    let title: String
    let systemImage: String
    let url: String

    init(_ title: String, systemImage: String, url: String) {
        self.title = title
        self.systemImage = systemImage
        self.url = url
    }

    var body: some View {
        Link(destination: URL(string: url)!) {
            Label(title, systemImage: systemImage)
                .font(.callout.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
        }
        .buttonStyle(.glass)
    }
}

private struct CreditsCard: View {
    private static let components = [
        Component(name: "Sparkle", role: "Software updates", license: "MIT", url: "https://sparkle-project.org"),
        Component(name: "LRCLIB", role: "Lyrics provider", license: "API", url: "https://lrclib.net"),
    ]

    var body: some View {
        Card {
            ForEach(Array(Self.components.enumerated()), id: \.element.name) { index, component in
                if index > 0 {
                    Divider().padding(.leading, 14)
                }
                CreditRow(component: component)
            }
        }
    }
}

private struct Component {
    let name: String
    let role: String
    let license: String
    let url: String
}

/// One credited project; the whole row opens its website.
///
/// Not a `Link`: a button draws a rounded, inset highlight of its own on
/// hover, where the row should light up edge to edge like a list row.
private struct CreditRow: View {
    let component: Component
    @Environment(\.openURL) private var openURL
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text(component.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                Text(component.role)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(component.license)
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(.quaternary, in: Capsule())
            Image(systemName: "arrow.up.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .opacity(isHovered ? 1 : 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity)
        .background(isHovered ? AnyShapeStyle(.quaternary.opacity(0.6)) : AnyShapeStyle(.clear))
        .contentShape(Rectangle())
        .onTapGesture { openURL(URL(string: component.url)!) }
        .onHover { isHovered = $0 }
        .pointerStyle(.link)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isLink)
        .help(component.url)
    }
}
