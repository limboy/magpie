import SwiftUI

struct ArtworkView: View {
    let path: String?
    var maxPixel = 128
    var cornerRadius: CGFloat = 6
    /// `.fill` crops to a square; `.fit` shows the whole image at its own
    /// shape, centered in the square.
    var contentMode: ContentMode = .fill

    @State private var image: NSImage?

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let image, contentMode == .fit {
                    Image(nsImage: image)
                        .resizable()
                        .scaledToFit()
                        .clipShape(.rect(cornerRadius: cornerRadius))
                        // Sits on the square's bottom edge, so whatever comes
                        // below keeps the same gap for any shape.
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        .transition(.opacity)
                } else {
                    ZStack {
                        Rectangle().fill(.quaternary)
                        GeometryReader { geometry in
                            Image(systemName: "music.note")
                                .font(.system(size: geometry.size.width * 0.38, weight: .light))
                                .foregroundStyle(.tertiary)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        if let image {
                            // Laid out inside the square (as an overlay) and
                            // clipped there, so wide or tall art can't spill out.
                            Color.clear.overlay {
                                Image(nsImage: image)
                                    .resizable()
                                    .scaledToFill()
                            }
                            .clipped()
                            .transition(.opacity)
                        }
                    }
                    .clipShape(.rect(cornerRadius: cornerRadius))
                }
            }
        .task(id: path.map { "\($0)#\(ArtworkCache.shared.generation($0))" }) {
            guard let path else {
                image = nil
                return
            }
            if let cached = ArtworkCache.shared.cached(path, maxPixel: maxPixel) {
                image = cached
                return
            }
            image = nil
            let loaded = await ArtworkCache.shared.image(path, maxPixel: maxPixel)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.25)) { image = loaded }
        }
    }
}
