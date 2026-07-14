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
    /// When forcing a refresh, ignore cached token until Apple delivers a new callback.
    private var awaitingFreshToken = false
    private var tokenSeenAtRequest: String?

    private override init() {
        super.init()
        if let saved = UserDefaults.standard.string(forKey: "apnsDeviceToken") {
            deviceToken = saved
        }
    }

    var appBundleId: String {
        Bundle.main.bundleIdentifier ?? "(unknown)"
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

    /// Ask for permission, get a (preferably fresh) Apple device token, then register with our API.
    func requestPermissionAndRegister(
        watchRequestId: String? = nil,
        forceNewToken: Bool = true
    ) async -> Bool {
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

            lastSyncMessage = forceNewToken
                ? "Requesting fresh Apple device token…"
                : "Waiting for Apple device token…"
            let token = try await waitForDeviceToken(
                timeoutSeconds: 20,
                forceNewToken: forceNewToken
            )
            lastSyncMessage = "Saving token to server…"
            try await syncToken(token, watchRequestId: watchRequestId)
            pendingRequestId = nil
            lastSyncMessage =
                "Registered with server · \(token.prefix(10))… (\(token.count) chars) · app \(appBundleId)"
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
        awaitingFreshToken = false

        Task {
            do {
                try await syncToken(token, watchRequestId: pendingRequestId)
                if lastSyncMessage == nil
                    || lastSyncMessage?.contains("Waiting") == true
                    || lastSyncMessage?.contains("Requesting fresh") == true
                {
                    lastSyncMessage =
                        "Registered with server · \(token.prefix(10))… (\(token.count) chars)"
                }
                pendingRequestId = nil
            } catch {
                lastError = error.localizedDescription
            }
        }
    }

    func handleRegistrationFailure(_ error: Error) {
        awaitingFreshToken = false
        lastError = error.localizedDescription
        lastSyncMessage = error.localizedDescription
    }

    /// Re-sync after login so the token is linked to the user account.
    func syncAfterLogin() async {
        do {
            if deviceToken == nil {
                _ = await requestPermissionAndRegister(forceNewToken: true)
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
        await requestPermissionAndRegister(watchRequestId: requestId, forceNewToken: false)
    }

    func clearLocalTokenCache() {
        deviceToken = nil
        UserDefaults.standard.removeObject(forKey: "apnsDeviceToken")
        lastSyncMessage = "Cleared local Apple token cache"
    }

    func unregister() async {
        guard let token = deviceToken, let api else { return }
        try? await api.unregisterPushToken(token)
        clearLocalTokenCache()
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func waitForDeviceToken(timeoutSeconds: Double, forceNewToken: Bool) async throws -> String {
        tokenSeenAtRequest = deviceToken

        if forceNewToken {
            // Drop cached value so we don't keep re-uploading a rejected BadDeviceToken.
            awaitingFreshToken = true
            UIApplication.shared.unregisterForRemoteNotifications()
            try await Task.sleep(nanoseconds: 400_000_000)
            UIApplication.shared.registerForRemoteNotifications()
        } else {
            UIApplication.shared.registerForRemoteNotifications()
            if let existing = deviceToken, !existing.isEmpty {
                return existing
            }
        }

        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while Date() < deadline {
            if let token = deviceToken, !token.isEmpty {
                if forceNewToken {
                    // Accept callback even if Apple returns the same token string —
                    // but only after we observed a registration callback (awaitingFreshToken cleared).
                    if !awaitingFreshToken {
                        return token
                    }
                } else {
                    return token
                }
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }

        // Fallback: if Apple didn't fire a new callback, use whatever we have
        // (often the same token — that's OK once server gateway/bundle are correct).
        if let token = deviceToken, !token.isEmpty {
            awaitingFreshToken = false
            return token
        }

        throw APIError.network(
            "Apple did not return a push token. Use a physical iPhone (not Simulator), and confirm Push Notifications is enabled in Xcode → Signing & Capabilities. App bundle: \(appBundleId)"
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

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

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
