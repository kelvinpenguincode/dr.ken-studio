import Foundation
import UIKit
import UserNotifications
import Combine

/// Handles APNs permission, device token registration, and backend sync.
@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()

    private static let tokenKey = "apnsDeviceToken"
    private static let tokenEnvKey = "apnsDeviceTokenApsEnvironment"

    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var deviceToken: String?
    @Published var lastError: String?
    @Published var lastSyncMessage: String?

    private var api: APIClient?
    private var pendingRequestId: String?
    /// When forcing a refresh, ignore cached token until Apple delivers a new callback.
    private var awaitingFreshToken = false

    private override init() {
        super.init()
        migrateCachedTokenIfNeeded()
        if let saved = UserDefaults.standard.string(forKey: Self.tokenKey) {
            deviceToken = saved
        }
    }

    var appBundleId: String {
        Bundle.main.bundleIdentifier ?? "(unknown)"
    }

    func configure(api: APIClient) {
        self.api = api
        migrateCachedTokenIfNeeded()
        refreshAuthorizationStatus()
    }

    /// TestFlight updates keep UserDefaults. A development token cached under a production
    /// build will make APNs return BadEnvironmentKeyInToken forever.
    private func migrateCachedTokenIfNeeded() {
        let signedEnv = PushBuildDiagnostics.apsEnvironment
        let cachedEnv = UserDefaults.standard.string(forKey: Self.tokenEnvKey)
        if let cachedEnv, cachedEnv != signedEnv {
            clearLocalTokenCache()
            lastSyncMessage =
                "Cleared old \(cachedEnv) push token (app is now \(signedEnv)). Tap Enable & sync."
            return
        }
        // Production build with a token but no env stamp → treat as suspicious, clear it.
        if signedEnv == "production",
           UserDefaults.standard.string(forKey: Self.tokenKey) != nil,
           cachedEnv == nil
        {
            clearLocalTokenCache()
            lastSyncMessage =
                "Cleared untagged cached push token. Tap Enable & sync for a fresh production token."
        }
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
                timeoutSeconds: 25,
                forceNewToken: forceNewToken
            )
            lastSyncMessage = "Saving token to server…"
            try await syncToken(token, watchRequestId: watchRequestId)
            pendingRequestId = nil
            lastSyncMessage =
                "Registered with server · \(token.prefix(10))… (\(token.count) chars) · \(PushBuildDiagnostics.apsEnvironment) · \(appBundleId)"
            return true
        } catch {
            lastError = error.localizedDescription
            lastSyncMessage = error.localizedDescription
            return false
        }
    }

    func handleDeviceToken(_ deviceTokenData: Data) {
        // Explicit byte hex — avoid format quirks with %02.2hhx under Release.
        let token = deviceTokenData.map { byte in
            String(format: "%02x", byte)
        }.joined()
        deviceToken = token
        UserDefaults.standard.set(token, forKey: Self.tokenKey)
        UserDefaults.standard.set(
            PushBuildDiagnostics.apsEnvironment,
            forKey: Self.tokenEnvKey
        )
        awaitingFreshToken = false

        #if targetEnvironment(simulator)
        let deviceKind = "simulator"
        #else
        let deviceKind = "device"
        #endif

        Task {
            do {
                try await syncToken(token, watchRequestId: pendingRequestId)
                if lastSyncMessage == nil
                    || lastSyncMessage?.contains("Waiting") == true
                    || lastSyncMessage?.contains("Requesting fresh") == true
                {
                    lastSyncMessage =
                        "Registered · \(token.prefix(10))… (\(token.count) chars, \(deviceTokenData.count) bytes, \(deviceKind)) · \(PushBuildDiagnostics.apsEnvironment)"
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
        await requestPermissionAndRegister(watchRequestId: requestId, forceNewToken: true)
    }

    func clearLocalTokenCache() {
        deviceToken = nil
        UserDefaults.standard.removeObject(forKey: Self.tokenKey)
        UserDefaults.standard.removeObject(forKey: Self.tokenEnvKey)
        lastSyncMessage = "Cleared local Apple token cache"
    }

    func unregister() async {
        guard let token = deviceToken, let api else { return }
        try? await api.unregisterPushToken(token)
        clearLocalTokenCache()
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func waitForDeviceToken(timeoutSeconds: Double, forceNewToken: Bool) async throws -> String {
        if forceNewToken {
            // Never re-upload a cached development token under a production build.
            // Do NOT call unregisterForRemoteNotifications() — it can leave APNs in a bad state.
            clearLocalTokenCache()
            awaitingFreshToken = true
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
                    // Only accept after didRegister callback cleared awaitingFreshToken.
                    if !awaitingFreshToken {
                        return token
                    }
                } else {
                    return token
                }
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }

        // Do NOT fall back to a stale cached token when forcing refresh.
        awaitingFreshToken = false
        throw APIError.network(
            "Apple did not return a fresh push token in time. Delete the app, reinstall from TestFlight, open More → Clear local token cache → Enable & sync. Signed push env: \(PushBuildDiagnostics.apsEnvironment), bundle: \(appBundleId)"
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
        // Request an APNs token early so Enable & sync does not rely on a stale cache.
        application.registerForRemoteNotifications()
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
