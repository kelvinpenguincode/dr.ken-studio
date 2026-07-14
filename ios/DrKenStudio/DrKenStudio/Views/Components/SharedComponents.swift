import SwiftUI

struct StudioHeader: View {
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 6) {
            Text("Dr. Ken Studio")
                .font(.system(.largeTitle, design: .serif).weight(.semibold))
                .foregroundStyle(AppTheme.accent)
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

struct StatusChip: View {
    let status: OrderStatus

    var body: some View {
        Text(status.label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var color: Color {
        switch status {
        case .SUBMITTED: return .blue
        case .REVIEWED: return .indigo
        case .ERROR_NEEDS_CORRECTION: return .red
        case .PROCESSING: return .orange
        case .READY_FOR_DELIVERY: return .green
        case .COMPLETED: return .mint
        case .CANCELLED: return .gray
        }
    }
}

struct MoneyTotalsView: View {
    let totals: MoneyTotals

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Order total")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.muted)
            Text(totals.usdText)
                .font(.title3.weight(.bold))
                .foregroundStyle(AppTheme.foreground)
            Text("≈ \(totals.cnyText) (USD × \(AppTheme.cnyRate.formatted()))")
                .font(.caption)
                .foregroundStyle(AppTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(AppTheme.accent)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(AppTheme.muted)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .studioCard()
    }
}

struct ProductPicker: View {
    @Binding var productId: String
    let products: [Product]

    private var groups: [(String, [Product])] {
        Dictionary(grouping: products) { $0.category?.isEmpty == false ? $0.category! : "Other" }
            .map { ($0.key, $0.value) }
            .sorted { $0.0 < $1.0 }
    }

    var body: some View {
        Picker("Product", selection: $productId) {
            Text("Select a product").tag("")
            ForEach(groups, id: \.0) { category, items in
                Section(category) {
                    ForEach(items) { product in
                        Text(product.name).tag(product.id)
                    }
                }
            }
        }
        .pickerStyle(.menu)
    }
}
