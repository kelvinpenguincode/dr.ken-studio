import SwiftUI

struct AccountHubView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showAuth = false

    var body: some View {
        List {
            if let user = appState.user {
                Section {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(AppTheme.accent).frame(width: 52, height: 52)
                            Text(String((user.name ?? user.email).prefix(1)).uppercased())
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name ?? "Member")
                                .font(.headline)
                            Text(user.email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)

                    NavigationLink("Edit profile") {
                        ProfileEditView()
                    }
                    NavigationLink("My orders") {
                        MyOrdersView()
                    }
                    NavigationLink("Claim guest order") {
                        ClaimOrderView()
                    }
                }

                Section {
                    Button("Log out", role: .destructive) {
                        Task {
                            try? await appState.api.logout()
                            appState.user = nil
                            Haptics.light()
                        }
                    }
                }
            } else {
                Section {
                    Text("Create an account to autofill details, track orders, and claim guest submissions.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Sign up or log in") {
                        showAuth = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)

                    Button("Continue as guest") {
                        appState.skipAuthPrompt()
                        Haptics.selection()
                    }
                }
            }

            Section("Privacy") {
                Text("Sessions are stored securely via cookies with your Dr. Ken Studio backend. Passwords never leave the encrypted HTTPS connection.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .scrollContentBackground(.hidden)
        .studioScreenBackground()
        .navigationTitle("Account")
        .sheet(isPresented: $showAuth) {
            AuthSheet()
        }
        .refreshable {
            await appState.refreshSession()
        }
    }
}

struct AuthSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var mode: AuthMode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var error: String?
    @State private var loading = false

    enum AuthMode { case login, signup }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Mode", selection: $mode) {
                    Text("Log in").tag(AuthMode.login)
                    Text("Sign up").tag(AuthMode.signup)
                }
                .pickerStyle(.segmented)

                if mode == .signup {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                }

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                SecureField("Password", text: $password)
                    .textContentType(mode == .signup ? .newPassword : .password)

                if mode == .signup {
                    TextField("Phone (optional)", text: $phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                    TextField("Address (optional)", text: $address)
                        .textContentType(.fullStreetAddress)

                    if !appState.orderDraft.formFillerName.isEmpty {
                        Text("Your in-progress order draft will stay on this phone after signup.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if loading {
                        ProgressView()
                    } else {
                        Text(mode == .login ? "Log in" : "Create account")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(loading || email.isEmpty || password.isEmpty)
            }
            .navigationTitle(mode == .login ? "Log in" : "Sign up")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear {
                if name.isEmpty { name = appState.orderDraft.formFillerName }
                if phone.isEmpty { phone = appState.orderDraft.recipients.first?.phone ?? "" }
                if address.isEmpty { address = appState.orderDraft.recipients.first?.address ?? "" }
            }
        }
        .presentationDetents([.large])
    }

    private func submit() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            if mode == .login {
                appState.user = try await appState.api.login(email: email, password: password)
            } else {
                appState.user = try await appState.api.signup(
                    email: email,
                    password: password,
                    name: name.isEmpty ? nil : name,
                    phone: phone.isEmpty ? nil : phone,
                    address: address.isEmpty ? nil : address
                )
                appState.applyProfileToDraftIfEmpty()
            }
            appState.skipAuthPrompt()
            Haptics.success()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
    }
}

struct ProfileEditView: View {
    @EnvironmentObject private var appState: AppState
    @State private var name = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var message: String?
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        Form {
            Section("Personal details") {
                TextField("Name", text: $name)
                TextField("Phone", text: $phone)
                    .keyboardType(.phonePad)
                TextField("Address", text: $address, axis: .vertical)
                    .lineLimit(2...4)
            }

            if let message {
                Section { Text(message).foregroundStyle(.green) }
            }
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            Section {
                Button {
                    Task { await save() }
                } label: {
                    if loading { ProgressView() } else { Text("Save profile") }
                }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || loading)
            } footer: {
                Text("Saved details help autofill your next order.")
            }
        }
        .navigationTitle("Profile")
        .onAppear {
            name = appState.user?.name ?? ""
            phone = appState.user?.phone ?? ""
            address = appState.user?.address ?? ""
        }
    }

    private func save() async {
        loading = true
        message = nil
        error = nil
        defer { loading = false }
        do {
            let user = try await appState.api.updateProfile(
                name: name.trimmingCharacters(in: .whitespaces),
                phone: phone.isEmpty ? nil : phone,
                address: address.isEmpty ? nil : address
            )
            appState.user = user
            appState.applyProfileToDraftIfEmpty()
            message = "Profile saved."
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
    }
}
