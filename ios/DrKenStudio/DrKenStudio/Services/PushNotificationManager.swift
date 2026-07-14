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
    @Published var lastSyncMessage: String?

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

    /// Ask for permission, wait for Apple's device token, then register with our API.
    func requestPermissionAndRegister(watchRequestId: String? = nil) async -> Bool {
        pendingRequestId = watchRequestId
        lastError = nil
        lastSyncMessage = "Asking for permission…"
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            refreshAuthorizationStatus()
            guard granted else {
                lastError = "Notifications are turned off in iPhone Settings → Dr. Ken Studio."
                lastSyncMessage = lastError
                return false
            }

            lastSyncMessage = "Waiting for Apple device token…"
            let token = try await waitForDeviceToken(timeoutSeconds: 15)
            lastSyncMessage = "Saving token to server…"
            try await syncToken(token, watchRequestId: watchRequestId)
            pendingRequestId = nil
            lastSyncMessage = "Registered with server · \(token.prefix(10))…"
            return true
        } catch {
            lastError = error.localizedDescription
            lastSyncMessage = error.localizedDescription
            return false
        }
    }

    func handleDeviceToken(_ deviceTokenData: Data) {
        let token = deviceTokenData.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token
        UserDefaults.standard.set(token, forKey: "apnsDeviceToken")

        // Background refresh if token arrives outside an explicit enable flow
        Task {
            do {
                try await syncToken(token, watchRequestId: pendingRequestId)
                if lastSyncMessage == nil || lastSyncMessage?.contains("Waiting") == true {
                    lastSyncMessage = "Registered with server · \(token.prefix(10))…"
                }
                pendingRequestId = nil
            } catch {
                lastError = error.localizedDescription
            }
        }
    }

    func handleRegistrationFailure(_ error: Error) {
        lastError = error.localizedDescription
        lastSyncMessage = error.localizedDescription
    }

    /// Re-sync after login so the token is linked to the user account.
    func syncAfterLogin() async {
        do {
            if deviceToken == nil {
                _ = await requestPermissionAndRegister()
                return
            }
            guard let token = deviceToken else { return }
            try await syncToken(token, watchRequestId: nil)
            lastSyncMessage = "Linked push token to your account"
        } catch {
            lastError = error.localizedDescription
            lastSyncMessage = error.localizedDescription
        }
    }

    func watchOrder(_ requestId: String) async -> Bool {
        await requestPermissionAndRegister(watchRequestId: requestId)
    }

    func unregister() async {
        guard let token = deviceToken, let api else { return }
        try? await api.unregisterPushToken(token)
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func waitForDeviceToken(timeoutSeconds: Double) async throws -> String {
        UIApplication.shared.registerForRemoteNotifications()

        if let existing = deviceToken, !existing.isEmpty {
            return existing
        }

        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while Date() < deadline {
            if let token = deviceToken, !token.isEmpty {
                return token
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }

        throw APIError.network(
            "Apple did not return a push token. Use a physical iPhone (not Simulator), and confirm Push Notifications is enabled for the app in Xcode → Signing & Capabilities."
        )
    }

    private func syncToken(_ token: String, watchRequestId: String?) async throws {
        guard let api else {
            throw APIError.network("API client not ready — set Server URL in More")
        }
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
