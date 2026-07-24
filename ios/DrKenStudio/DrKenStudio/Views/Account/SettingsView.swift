import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var pushManager: PushNotificationManager
    @AppStorage("adminModeEnabled") private var adminModeEnabled = false
    @State private var apiURL: String = UserDefaults.standard.string(forKey: "apiBaseURL") ?? AppState.defaultBaseURL
    @State private var saved = false
    @State private var pushMessage: String?

    var body: some View {
        List {
            Section {
                LabeledContent("Alerts", value: pushStatusLabel)
                Button("Enable order alerts") {
                    Task {
                        let ok = await pushManager.requestPermissionAndRegister(forceNewToken: true)
                        pushMessage = ok
                            ? (pushManager.lastSyncMessage ?? "Registered with server")
                            : (pushManager.lastSyncMessage ?? pushManager.lastError ?? "Failed")
                        Haptics.light()
                    }
                }
                if pushManager.authorizationStatus == .denied {
                    Button("Open iOS Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                if let pushMessage {
                    Text(pushMessage)
                        .font(.footnote)
                        .foregroundStyle(
                            pushMessage.contains("Registered") || pushMessage.contains("Linked")
                                ? .green
                                : .secondary
                        )
                } else if let sync = pushManager.lastSyncMessage, adminModeEnabled {
                    Text(sync)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Notifications")
            } footer: {
                Text("Get notified when your order status changes.")
            }

            Section("About") {
                LabeledContent("App", value: "Dr. Ken Studio")
                LabeledContent("Version", value: appVersionLabel)
                LabeledContent("CNY rate", value: "USD × \(AppTheme.cnyRate.formatted())")
            }

            Section {
                Toggle("Admin mode", isOn: $adminModeEnabled)
                    .tint(AppTheme.accent)
            } header: {
                Text("Developer")
            } footer: {
                Text("Shows server URL, push diagnostics, and other debug tools used while building the app.")
            }

            if adminModeEnabled {
                adminDebugSections
            }
        }
        .scrollContentBackground(.hidden)
        .studioScreenBackground()
        .navigationTitle("More")
        .onAppear {
            pushManager.refreshAuthorizationStatus()
        }
        .onChange(of: adminModeEnabled) { _, enabled in
            if enabled { Haptics.light() }
        }
    }

    @ViewBuilder
    private var adminDebugSections: some View {
        Section("Server") {
            TextField("API base URL", text: $apiURL)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
                .autocorrectionDisabled()
            Button("Save & reconnect") {
                saveURL()
            }
            .disabled(apiURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            if saved {
                Text("Saved. Reloading…")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }

            Text("Use your Vercel URL, e.g. https://your-app.vercel.app (no trailing slash).")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }

        Section("Push diagnostics") {
            LabeledContent("Permission", value: pushStatusLabel)
            LabeledContent("App bundle", value: pushManager.appBundleId)
            LabeledContent("Build", value: PushBuildDiagnostics.versionLabel)
            LabeledContent("Push env (signed)", value: PushBuildDiagnostics.apsEnvironment)
            if PushBuildDiagnostics.apsEnvironment == "development" {
                Text("CODESIGN says DEVELOPMENT — Apple will only mint sandbox tokens. Reinstalling won’t help. On Mac: export App Store IPA → bash verify-push-entitlements.sh Your.ipa → must say production → upload THAT IPA only.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            } else if PushBuildDiagnostics.apsEnvironment.contains("unknown")
                        || PushBuildDiagnostics.apsEnvironment.contains("unreadable") {
                Text("On-device codesign can’t be read (common on TestFlight). Trust only Mac verify-push-entitlements.sh on the IPA — not this label alone.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            } else if PushBuildDiagnostics.apsEnvironment == "production",
                      !PushBuildDiagnostics.isTestFlightInstall
            {
                Text("Production entitlement but not a TestFlight/App Store receipt — confirm install source.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
            if let token = pushManager.deviceToken {
                Text("Apple token (\(token.count) chars):")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(token)
                    .font(.system(.caption2, design: .monospaced))
                    .textSelection(.enabled)
                Button("Copy full Apple token") {
                    UIPasteboard.general.string = token
                    pushMessage = "Token copied — use with test-device-token.sh on the Mac"
                    Haptics.light()
                }
            } else {
                Text("Apple token: not received yet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Button("Enable & sync order alerts") {
                Task {
                    let ok = await pushManager.requestPermissionAndRegister(forceNewToken: true)
                    pushMessage = ok
                        ? (pushManager.lastSyncMessage ?? "Registered with server")
                        : (pushManager.lastSyncMessage ?? pushManager.lastError ?? "Failed")
                    Haptics.light()
                }
            }
            Button("Clear local token cache") {
                pushManager.clearLocalTokenCache()
                pushMessage = "Local cache cleared — tap Enable & sync next"
                Haptics.light()
            }
            Text("“Push env (signed)” must be production for TestFlight. App bundle must match Vercel APNS_BUNDLE_ID.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }

        Section("Admin website") {
            Text("Full admin tools (tables, CSV, reports) stay on the website.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let url = URL(string: apiURL + "/admin") {
                Link("Open admin website", destination: url)
            }
        }
    }

    private var appVersionLabel: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }

    private var pushStatusLabel: String {
        switch pushManager.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return "On"
        case .denied: return "Off (Settings)"
        case .notDetermined: return "Not asked yet"
        @unknown default: return "Unknown"
        }
    }

    private func saveURL() {
        let trimmed = apiURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true else {
            appState.showToast("Enter a valid https URL")
            Haptics.error()
            return
        }
        UserDefaults.standard.set(trimmed, forKey: "apiBaseURL")
        appState.api.baseURL = url
        pushManager.configure(api: appState.api)
        saved = true
        Haptics.success()
        Task {
            await appState.bootstrap()
            saved = false
        }
    }
}
