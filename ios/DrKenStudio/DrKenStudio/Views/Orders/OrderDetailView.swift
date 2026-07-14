import SwiftUI

struct OrderDetailView: View {
    @EnvironmentObject private var appState: AppState
    @State var order: OrderDetail

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(order.requestId)
                            .font(.title2.weight(.bold))
                        StatusChip(status: order.status)
                    }
                    Spacer()
                    ShareLink(item: "Dr. Ken Studio request ID: \(order.requestId)") {
                        Image(systemName: "square.and.arrow.up")
                            .font(.title3)
                    }
                    .accessibilityLabel("Share request ID")
                }
                .studioCard()

                infoCard

                sectionTitle("Incoming packages")
                ForEach(order.incomingOrders) { incoming in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(incoming.orderNumber).font(.headline)
                        Text("Pickup: \(incoming.pickupCode)").font(.subheadline).foregroundStyle(AppTheme.muted)
                        ForEach(incoming.products) { line in
                            Text("\(line.product.name) × \(line.quantity)")
                                .font(.caption)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .studioCard()
                }

                sectionTitle("Recipients")
                ForEach(order.recipients) { recipient in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(recipient.name).font(.headline)
                        Text(recipient.phone).font(.subheadline)
                        Text(recipient.address).font(.subheadline).foregroundStyle(AppTheme.muted)
                        if let notes = recipient.notes, !notes.isEmpty {
                            Text("Note: \(notes)").font(.caption)
                        }
                        ForEach(recipient.products) { line in
                            let unit = MoneyTotals.unitPrice(name: line.product.name, fallback: line.product.priceUsd)
                            Text("\(line.product.name) × \(line.quantity) ($\(String(format: "%.2f", unit)) each)")
                                .font(.caption)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .studioCard()
                }

                MoneyTotalsView(totals: order.totals)

                Button {
                    Task {
                        let ok = await PushNotificationManager.shared.watchOrder(order.requestId)
                        appState.showToast(ok ? "You’ll get alerts for this order" : "Enable notifications in Settings")
                    }
                } label: {
                    Label("Notify me about this order", systemImage: "bell.badge")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)

                if !order.status.isEditable {
                    Text("Editing is locked because this order is \(order.status.label.lowercased()).")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .studioCard()
                }

                Button {
                    Task { await reload() }
                } label: {
                    Label("Refresh status", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .padding()
        }
        .studioScreenBackground()
        .navigationTitle("Order detail")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            row("Form filler", order.formFillerName)
            row("Submitted", formatDate(order.createdAt))
            row("Account", order.user?.email ?? "Guest")
        }
        .studioCard()
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(AppTheme.foreground)
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(AppTheme.muted)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) {
            return date.formatted(date: .abbreviated, time: .shortened)
        }
        return iso
    }

    private func reload() async {
        do {
            order = try await appState.api.getOrder(requestId: order.requestId)
            Haptics.light()
        } catch {
            appState.showToast(error.localizedDescription)
            Haptics.error()
        }
    }
}
