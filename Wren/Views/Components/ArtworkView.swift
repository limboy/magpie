import SwiftUI

struct ArtworkView: View {
    let path: String?
    var maxPixel = 128
    var cornerRadius: CGFloat = 6

    @State private var image: NSImage?

    var body: some View {
        ZStack {
            Rectangle().fill(.quaternary)
            GeometryReader { geometry in
                Image(systemName: "music.note")
                    .font(.system(size: geometry.size.width * 0.38, weight: .light))
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(.rect(cornerRadius: cornerRadius))
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
