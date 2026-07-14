import SwiftUI

struct OrdersHubView: View {
    @EnvironmentObject private var appState: AppState
    @State private var pushOrder: OrderDetail?
    @State private var showPushOrder = false

    var body: some View {
        List {
            Section {
                NavigationLink {
                    SearchOrdersView()
                } label: {
                    Label("Search orders", systemImage: "magnifyingglass")
                }

                if appState.user != nil {
                    NavigationLink {
                        MyOrdersView()
                    } label: {
                        Label("My current & past orders", systemImage: "tray.full")
                    }

                    NavigationLink {
                        ClaimOrderView()
                    } label: {
                        Label("Claim a guest order", systemImage: "link.badge.plus")
                    }
                } else {
                    Text("Log in from the Account tab to see your order history and claim guest orders.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Tips") {
                Label("Keep your request ID after every submission", systemImage: "number.square")
                Label("Guest orders can be linked later with the ID", systemImage: "person.badge.plus")
                Label("Enable notifications to track status changes", systemImage: "bell.badge")
                Label("Editing locks once an order is Processing", systemImage: "lock")
            }
            .font(.subheadline)
        }
        .scrollContentBackground(.hidden)
        .studioScreenBackground()
        .navigationTitle("Orders")
        .navigationDestination(isPresented: $showPushOrder) {
            if let pushOrder {
                OrderDetailView(order: pushOrder)
            }
        }
        .onChange(of: appState.openRequestIdFromPush) { _, requestId in
            guard let requestId else { return }
            Task {
                do {
                    pushOrder = try await appState.api.getOrder(requestId: requestId)
                    showPushOrder = true
                    appState.openRequestIdFromPush = nil
                } catch {
                    appState.showToast(error.localizedDescription)
                }
            }
        }
    }
}

struct SearchOrdersView: View {
    @EnvironmentObject private var appState: AppState
    @State private var query = ""
    @State private var order: OrderDetail?
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        Form {
            Section("Find order") {
                TextField("Request ID or tracking number", text: $query)
                    .textInputAutocapitalization(.characters)
                Button {
                    Task { await search() }
                } label: {
                    if loading { ProgressView() } else { Text("Search") }
                }
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || loading)
            }

            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            if let order {
                Section("Result") {
                    NavigationLink {
                        OrderDetailView(order: order)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(order.requestId).font(.headline)
                            StatusChip(status: order.status)
                            Text(order.formFillerName).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Search")
    }

    private func search() async {
        loading = true
        error = nil
        order = nil
        defer { loading = false }
        do {
            order = try await appState.api.searchOrder(query: query.trimmingCharacters(in: .whitespaces))
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
    }
}

struct MyOrdersView: View {
    @EnvironmentObject private var appState: AppState
    @State private var orders: [OrderDetail] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        Group {
            if loading {
                ProgressView("Loading orders…")
            } else if let error {
                ContentUnavailableView("Couldn’t load", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if orders.isEmpty {
                ContentUnavailableView("No orders yet", systemImage: "shippingbox", description: Text("Submit an order or claim a guest order."))
            } else {
                List {
                    Section("Current") {
                        ForEach(orders.filter { $0.status.isCurrent }) { order in
                            orderLink(order)
                        }
                    }
                    Section("History") {
                        ForEach(orders.filter { !$0.status.isCurrent }) { order in
                            orderLink(order)
                        }
                    }
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("My orders")
        .task { await load() }
    }

    private func orderLink(_ order: OrderDetail) -> some View {
        NavigationLink {
            OrderDetailView(order: order)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(order.requestId).font(.headline)
                        Text(order.totals.usdText).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    StatusChip(status: order.status)
                }
                OrderStatusTracker(status: order.status)
            }
            .padding(.vertical, 4)
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            orders = try await appState.api.myOrders()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ClaimOrderView: View {
    @EnvironmentObject private var appState: AppState
    @State private var value = ""
    @State private var message: String?
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        Form {
            Section {
                Text("If you ordered as a guest, enter your request ID or incoming tracking number. It must not already be linked to another account.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextField("Request ID or order number", text: $value)
                Button {
                    Task { await claim() }
                } label: {
                    if loading { ProgressView() } else { Text("Add to my account") }
                }
                .disabled(value.isEmpty || loading)
            }

            if let message {
                Section { Text(message).foregroundStyle(.green) }
            }
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Claim order")
    }

    private func claim() async {
        loading = true
        message = nil
        error = nil
        defer { loading = false }
        do {
            let order = try await appState.api.claimOrder(orderNumber: value)
            message = "Linked \(order.requestId) to your account."
            value = ""
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
    }
}
