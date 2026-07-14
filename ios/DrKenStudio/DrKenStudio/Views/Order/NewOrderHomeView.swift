import SwiftUI

/// Home for new orders — step wizard instead of one long form.
struct NewOrderHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showAuthSheet = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                StudioHeader(subtitle: "Submit package & delivery requests")

                if appState.user == nil && !appState.skippedAuthPrompt {
                    authPrompt
                }

                VStack(alignment: .leading, spacing: 12) {
                    Label("Quick start", systemImage: "sparkles")
                        .font(.headline)
                        .foregroundStyle(AppTheme.foreground)

                    Text("A short guided flow — one step at a time. Your progress is saved on this phone.")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.muted)

                    NavigationLink {
                        OrderWizardView()
                    } label: {
                        Label(hasDraftProgress ? "Continue order draft" : "Start new order", systemImage: "plus.circle.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)

                    if hasDraftProgress {
                        Button(role: .destructive) {
                            appState.clearDraft()
                            Haptics.light()
                        } label: {
                            Label("Clear draft", systemImage: "trash")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .studioCard()

                shortcuts
            }
            .padding()
        }
        .studioScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAuthSheet) {
            AuthSheet()
        }
        .onAppear {
            appState.applyProfileToDraftIfEmpty()
        }
    }

    private var hasDraftProgress: Bool {
        let d = appState.orderDraft
        return !d.formFillerName.isEmpty
            || d.incomingOrders.contains { !$0.orderNumber.isEmpty || !$0.pickupCode.isEmpty }
            || d.recipients.contains { !$0.name.isEmpty || !$0.phone.isEmpty }
    }

    private var authPrompt: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Save your progress?")
                .font(.headline)
            Text("Sign in to autofill your profile, track orders, and claim guest submissions later.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.muted)
            HStack {
                Button("Sign up / Log in") {
                    showAuthSheet = true
                    Haptics.light()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)

                Button("Skip for now") {
                    appState.skipAuthPrompt()
                    Haptics.selection()
                }
                .buttonStyle(.bordered)
            }
        }
        .studioCard()
    }

    private var shortcuts: some View {
        VStack(spacing: 10) {
            NavigationLink {
                SearchOrdersView()
            } label: {
                shortcutRow(icon: "magnifyingglass", title: "Find an order", subtitle: "By request ID or tracking number")
            }

            if appState.user != nil {
                NavigationLink {
                    MyOrdersView()
                } label: {
                    shortcutRow(icon: "list.bullet.rectangle", title: "My orders", subtitle: "Current and past submissions")
                }
            }
        }
    }

    private func shortcutRow(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(AppTheme.accent)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(AppTheme.foreground)
                Text(subtitle).font(.caption).foregroundStyle(AppTheme.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(AppTheme.muted)
        }
        .padding()
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border.opacity(0.8), lineWidth: 1)
        )
    }
}
