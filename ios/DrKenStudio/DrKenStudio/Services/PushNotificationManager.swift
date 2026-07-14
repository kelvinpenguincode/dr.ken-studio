import Foundation
import UIKit
import UserNotifications
import Combine

/// Handles APNs permission, device token registration, and backend sync.
@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()

    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var deviceToken: String?
    @Published var lastError: String?

    private var api: APIClient?
    private var pendingRequestId: String?

    private override init() {
        super.init()
        if let saved = UserDefaults.standard.string(forKey: "apnsDeviceToken") {
            deviceToken = saved
        }
    }

    func configure(api: APIClient) {
        self.api = api
        refreshAuthorizationStatus()
    }

    func refreshAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            Task { @MainActor in
                self.authorizationStatus = settings.authorizationStatus
            }
        }
    }

    /// Ask for permission and register with Apple + our API.
    func requestPermissionAndRegister(watchRequestId: String? = nil) async -> Bool {
        pendingRequestId = watchRequestId
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            refreshAuthorizationStatus()
            guard granted else {
                lastError = "Notifications are turned off in Settings."
                return false
            }
            UIApplication.shared.registerForRemoteNotifications()
            // If we already have a token (re-enable), sync immediately
            if let token = deviceToken {
                try await syncToken(token, watchRequestId: watchRequestId)
            }
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func handleDeviceToken(_ deviceTokenData: Data) {
        let token = deviceTokenData.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token
        UserDefaults.standard.set(token, forKey: "apnsDeviceToken")
        Task {
            try? await syncToken(token, watchRequestId: pendingRequestId)
            pendingRequestId = nil
        }
    }

    func handleRegistrationFailure(_ error: Error) {
        lastError = error.localizedDescription
    }

    /// Re-sync after login so the token is linked to the user account.
    func syncAfterLogin() async {
        guard let token = deviceToken else {
            // No token yet — request permission for signed-in users
            _ = await requestPermissionAndRegister()
            return
        }
        try? await syncToken(token, watchRequestId: nil)
    }

    func watchOrder(_ requestId: String) async -> Bool {
        let ok = await requestPermissionAndRegister(watchRequestId: requestId)
        if ok, let token = deviceToken {
            try? await syncToken(token, watchRequestId: requestId)
        }
        return ok
    }

    func unregister() async {
        guard let token = deviceToken, let api else { return }
        try? await api.unregisterPushToken(token)
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func syncToken(_ token: String, watchRequestId: String?) async throws {
        guard let api else { return }
        try await api.registerPushToken(token: token, requestId: watchRequestId)
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// Deep-link target when user taps a push notification
    static var pendingOpenRequestId: String?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.handleRegistrationFailure(error)
        }
    }

    // Foreground presentation
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // Tap notification
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let requestId = userInfo["requestId"] as? String {
            AppDelegate.pendingOpenRequestId = requestId
            NotificationCenter.default.post(
                name: .didTapOrderNotification,
                object: nil,
                userInfo: ["requestId": requestId]
            )
        }
        completionHandler()
    }
}

extension Notification.Name {
    static let didTapOrderNotification = Notification.Name("didTapOrderNotification")
}
