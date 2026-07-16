import Foundation

/// Best-effort diagnostics for the installed build’s push environment.
/// Avoids macOS-only Security SecCode APIs (not available on iOS).
enum PushBuildDiagnostics {
    /// `development` or `production` from the signed profile / build config.
    static var apsEnvironment: String {
        if let fromProfile = apsEnvironmentFromMobileProvision() {
            return fromProfile
        }
        #if DEBUG
        return "development"
        #else
        return "production"
        #endif
    }

    static var isTestFlightInstall: Bool {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }

    static var versionLabel: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        let channel = isTestFlightInstall
            ? "TestFlight"
            : (Bundle.main.appStoreReceiptURL != nil ? "App Store" : "Dev/sideload")
        return "\(version) (\(build)) · \(channel)"
    }

    /// App Store / TestFlight / Ad Hoc builds include `embedded.mobileprovision`.
    private static func apsEnvironmentFromMobileProvision() -> String? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let text = String(data: data, encoding: .ascii) ?? String(data: data, encoding: .utf8)
        else {
            return nil
        }

        // Provision profiles are CMS-wrapped; the plist sits inside as XML.
        guard let start = text.range(of: "<?xml"),
              let end = text.range(of: "</plist>")
        else {
            return nil
        }

        let xml = String(text[start.lowerBound..<end.upperBound])
        guard let plistData = xml.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(
                  from: plistData,
                  options: [],
                  format: nil
              ) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any],
              let env = entitlements["aps-environment"] as? String
        else {
            return nil
        }

        return env
    }
}
