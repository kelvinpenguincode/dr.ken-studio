import SwiftUI

enum AppTheme {
    static let accent = Color(red: 0.604, green: 0.420, blue: 0.184) // #9a6b2f
    static let accentDark = Color(red: 0.498, green: 0.337, blue: 0.141)
    static let cream = Color(red: 0.957, green: 0.937, blue: 0.902) // #f4efe6
    static let creamDark = Color(red: 0.922, green: 0.890, blue: 0.839)
    static let border = Color(red: 0.867, green: 0.824, blue: 0.761)
    static let muted = Color(red: 0.478, green: 0.427, blue: 0.380)
    static let foreground = Color(red: 0.247, green: 0.204, blue: 0.173)

    static let cnyRate: Double = 6.8
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AppTheme.border.opacity(0.8), lineWidth: 1)
            )
    }
}

extension View {
    func studioCard() -> some View {
        modifier(CardStyle())
    }

    func studioScreenBackground() -> some View {
        self.background(AppTheme.cream.ignoresSafeArea())
    }
}
