import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var pushManager: PushNotificationManager
    @State private var apiURL: String = UserDefaults.standard.string(forKey: "apiBaseURL") ?? AppState.defaultBaseURL
    @State private var saved = false
    @State private var pushMessage: String?

    var body: some View {
        List {
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

            Section("Notifications") {
                LabeledContent("Status", value: pushStatusLabel)
                if let token = pushManager.deviceToken {
                    Text("Token: \(token.prefix(12))…")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Button("Enable order alerts") {
                    Task {
                        let ok = await pushManager.requestPermissionAndRegister()
                        pushMessage = ok
                            ? "Notifications enabled"
                            : (pushManager.lastError ?? "Permission denied")
                        Haptics.light()
                    }
                }
                if let pushMessage {
                    Text(pushMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Text("You’ll get alerts when an admin changes an order status (Processing, Ready, Completed, etc.).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("About") {
                LabeledContent("App", value: "Dr. Ken Studio")
                LabeledContent("Platform", value: "iOS companion")
                LabeledContent("CNY rate", value: "USD × \(AppTheme.cnyRate.formatted())")
            }

            Section("Recommendations built in") {
                bullet("Tab bar for Order / Orders / Account / More")
                bullet("Step-by-step order wizard instead of one long form")
                bullet("Local draft autosave on device")
                bullet("Push notifications for status updates")
                bullet("Share Sheet for request IDs")
                bullet("Pull-to-refresh on order lists")
                bullet("Haptics on key actions")
                bullet("Guest skip + later claim by order number")
            }

            Section("Admin") {
                Text("Admin tools stay on the website for now (better for large tables, CSV, and reports). Use Safari or Chrome with your admin login.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if let url = URL(string: apiURL + "/admin") {
                    Link("Open admin website", destination: url)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .studioScreenBackground()
        .navigationTitle("More")
        .onAppear {
            pushManager.refreshAuthorizationStatus()
        }
    }

    private var pushStatusLabel: String {
        switch pushManager.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return "On"
        case .denied: return "Off (Settings)"
        case .notDetermined: return "Not asked yet"
        @unknown default: return "Unknown"
        }
    }

    private func bullet(_ text: String) -> some View {
        Label(text, systemImage: "checkmark.circle.fill")
            .font(.footnote)
            .foregroundStyle(AppTheme.foreground)
            .symbolRenderingMode(.hierarchical)
            .tint(AppTheme.accent)
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
