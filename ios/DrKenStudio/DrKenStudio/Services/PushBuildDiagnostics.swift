import Foundation
import Security

/// Reads signing entitlements from the installed binary (what App Store / TestFlight actually signed).
enum PushBuildDiagnostics {
    /// `development` or `production` from `aps-environment`, or a diagnostic string.
    static var apsEnvironment: String {
        var staticCode: SecStaticCode?
        let status = SecStaticCodeCreateWithPath(
            Bundle.main.bundleURL as CFURL,
            [],
            &staticCode
        )
        guard status == errSecSuccess, let staticCode else {
            return "unreadable"
        }

        var info: CFDictionary?
        let copyStatus = SecCodeCopySigningInformation(
            staticCode,
            SecCSFlags(rawValue: kSecCSSigningInformation),
            &info
        )
        guard copyStatus == errSecSuccess,
              let info,
              let dict = info as? [String: Any]
        else {
            return "unreadable"
        }

        // Entitlements dictionary key
        let entitlements =
            dict[kSecCodeInfoEntitlementsDict as String] as? [String: Any]
            ?? dict["entitlements"] as? [String: Any]

        if let env = entitlements?["aps-environment"] as? String {
            return env
        }
        return "missing"
    }

    static var isTestFlightInstall: Bool {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }

    static var versionLabel: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        let channel = isTestFlightInstall ? "TestFlight" : (Bundle.main.appStoreReceiptURL != nil ? "App Store" : "Dev/sideload")
        return "\(version) (\(build)) · \(channel)"
    }
}
