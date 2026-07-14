import Foundation
import SwiftUI
import Combine

/// Shared app state: auth, products, drafts, and configuration.
@MainActor
final class AppState: ObservableObject {
    @Published var user: UserProfile?
    @Published var products: [Product] = []
    @Published var isBootstrapping = true
    @Published var skippedAuthPrompt = false
    @Published var orderDraft = OrderDraft.empty
    @Published var toastMessage: String?
    @Published var selectedTab = 0
    @Published var openRequestIdFromPush: String?

    let api: APIClient

    /// Change this to your Vercel URL after deploy (no trailing slash).
    nonisolated static let defaultBaseURL = "https://YOUR-APP.vercel.app"

    init(api: APIClient? = nil) {
        self.api = api ?? APIClient(baseURL: AppState.resolvedBaseURL())
        self.skippedAuthPrompt = UserDefaults.standard.bool(forKey: "skippedAuthPrompt")
        if let draft = OrderDraftStore.load() {
            self.orderDraft = draft
        }
        Task { await bootstrap() }
    }

    nonisolated static func resolvedBaseURL() -> URL {
        if let custom = UserDefaults.standard.string(forKey: "apiBaseURL"),
           let url = URL(string: custom), !custom.isEmpty {
            return url
        }
        return URL(string: defaultBaseURL)!
    }

    func bootstrap() async {
        isBootstrapping = true
        defer { isBootstrapping = false }
        async let me: () = refreshSession()
        async let catalog: () = loadProducts()
        _ = await (me, catalog)
    }

    func refreshSession() async {
        do {
            user = try await api.currentUser()
        } catch {
            user = nil
        }
    }

    func loadProducts() async {
        do {
            products = try await api.fetchProducts()
        } catch {
            products = []
            showToast("Could not load products. Check API URL in Settings.")
        }
    }

    func skipAuthPrompt() {
        skippedAuthPrompt = true
        UserDefaults.standard.set(true, forKey: "skippedAuthPrompt")
    }

    func saveDraft() {
        OrderDraftStore.save(orderDraft)
    }

    func clearDraft() {
        orderDraft = .empty
        OrderDraftStore.clear()
    }

    func showToast(_ message: String) {
        toastMessage = message
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            if toastMessage == message { toastMessage = nil }
        }
    }

    func applyProfileToDraftIfEmpty() {
        guard let user else { return }
        if orderDraft.formFillerName.isEmpty, let name = user.name, !name.isEmpty {
            orderDraft.formFillerName = name
        }
        if orderDraft.recipients.indices.contains(0) {
            if orderDraft.recipients[0].name.isEmpty, let name = user.name {
                orderDraft.recipients[0].name = name
            }
            if orderDraft.recipients[0].phone.isEmpty, let phone = user.phone {
                orderDraft.recipients[0].phone = phone
            }
            if orderDraft.recipients[0].address.isEmpty, let address = user.address {
                orderDraft.recipients[0].address = address
            }
        }
        saveDraft()
    }
}
