import SwiftUI

@main
struct DrKenStudioApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState()
    @ObservedObject private var pushManager = PushNotificationManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(pushManager)
                .tint(AppTheme.accent)
                .preferredColorScheme(.light)
                .onAppear {
                    pushManager.configure(api: appState.api)
                }
                .onChange(of: appState.user?.id) { _, newValue in
                    if newValue != nil {
                        Task { await pushManager.syncAfterLogin() }
                    }
                }
        }
    }
}
