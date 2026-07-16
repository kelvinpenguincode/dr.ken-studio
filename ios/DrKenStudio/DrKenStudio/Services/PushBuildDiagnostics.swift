import Foundation

/// Push-environment diagnostics for the installed build.
enum PushBuildDiagnostics {
    /// Prefer Info.plist build setting (always present), then mobileprovision if any.
    static var apsEnvironment: String {
        if let fromInfo = Bundle.main.object(forInfoDictionaryKey: "DKPushAPSEnvironment") as? String,
           !fromInfo.isEmpty
        {
            return fromInfo
        }
        if let fromProfile = apsEnvironmentFromMobileProvision() {
            return fromProfile
        }
        #if DEBUG
        return "development"
        #else
        // TestFlight often has no embedded.mobileprovision — don't pretend we read production.
        return "release-build-unknown"
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

    private static func apsEnvironmentFromMobileProvision() -> String? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let text = String(data: data, encoding: .ascii) ?? String(data: data, encoding: .utf8)
        else {
            return nil
        }

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
