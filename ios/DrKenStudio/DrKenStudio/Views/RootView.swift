import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var pushManager: PushNotificationManager

    var body: some View {
        ZStack(alignment: .top) {
            MainTabView()

            if appState.isBootstrapping {
                ProgressView("Loading Dr. Ken Studio…")
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .padding(.top, 60)
            }

            if let toast = appState.toastMessage {
                Text(toast)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(AppTheme.accentDark, in: Capsule())
                    .padding(.top, 56)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut, value: appState.toastMessage)
        .animation(.easeInOut, value: appState.isBootstrapping)
        .onReceive(NotificationCenter.default.publisher(for: .didTapOrderNotification)) { note in
            if let requestId = note.userInfo?["requestId"] as? String {
                appState.openRequestIdFromPush = requestId
                appState.selectedTab = 1
            }
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            NavigationStack {
                NewOrderHomeView()
            }
            .tabItem { Label("Order", systemImage: "plus.circle.fill") }
            .tag(0)

            NavigationStack {
                OrdersHubView()
            }
            .tabItem { Label("Orders", systemImage: "shippingbox.fill") }
            .tag(1)

            NavigationStack {
                AccountHubView()
            }
            .tabItem { Label("Account", systemImage: "person.crop.circle.fill") }
            .tag(2)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
            .tag(3)
        }
        .onChange(of: appState.selectedTab) { _, _ in
            Haptics.selection()
        }
    }
}
