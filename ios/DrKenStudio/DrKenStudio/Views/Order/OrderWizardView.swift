import SwiftUI

/// Step-by-step order form — easier on phone than one long scroll page.
struct OrderWizardView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var step = 0
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var submittedId: String?
    @State private var showSuccess = false

    private let steps = ["Your info", "Packages", "Recipients", "Review"]

    var body: some View {
        VStack(spacing: 0) {
            progressHeader

            TabView(selection: $step) {
                fillerStep.tag(0)
                packagesStep.tag(1)
                recipientsStep.tag(2)
                reviewStep.tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: step)

            footerButtons
        }
        .studioScreenBackground()
        .navigationTitle("New order")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Order submitted", isPresented: $showSuccess) {
            Button("Notify me of updates") {
                if let id = submittedId {
                    Task {
                        let ok = await PushNotificationManager.shared.watchOrder(id)
                        appState.showToast(ok ? "Notifications on for \(id)" : "Could not enable notifications")
                    }
                }
                dismiss()
            }
            Button("Done") { dismiss() }
            if let id = submittedId {
                ShareLink(item: "Dr. Ken Studio request ID: \(id)") {
                    Text("Share ID")
                }
            }
        } message: {
            Text("Save your request ID: \(submittedId ?? ""). Turn on notifications to get status updates.")
        }
        .onChange(of: appState.orderDraft) { _, _ in
            appState.saveDraft()
        }
    }

    private var progressHeader: some View {
        VStack(spacing: 8) {
            HStack {
                ForEach(steps.indices, id: \.self) { index in
                    Capsule()
                        .fill(index <= step ? AppTheme.accent : AppTheme.border)
                        .frame(height: 4)
                }
            }
            Text(steps[step])
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.muted)
        }
        .padding()
    }

    // MARK: Steps

    private var fillerStep: some View {
        Form {
            Section("Form filler") {
                TextField("Your name", text: $appState.orderDraft.formFillerName)
                    .textContentType(.name)
            }
            Section {
                Text("This is used on your submission summary.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var packagesStep: some View {
        Form {
            ForEach($appState.orderDraft.incomingOrders) { $incoming in
                Section("Package") {
                    TextField("Order / tracking number", text: $incoming.orderNumber)
                        .textInputAutocapitalization(.characters)
                    TextField("Pickup code", text: $incoming.pickupCode)

                    ForEach($incoming.products) { $line in
                        productLineEditor($line)
                    }

                    Button("Add product") {
                        incoming.products.append(ProductLineDraft())
                        Haptics.light()
                    }
                }
            }

            Button {
                appState.orderDraft.incomingOrders.append(IncomingDraft())
                Haptics.light()
            } label: {
                Label("Add another package", systemImage: "plus")
            }
        }
    }

    private var recipientsStep: some View {
        Form {
            ForEach($appState.orderDraft.recipients) { $recipient in
                Section("Recipient") {
                    TextField("Name", text: $recipient.name)
                        .textContentType(.name)
                    TextField("Phone", text: $recipient.phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                    TextField("Address", text: $recipient.address, axis: .vertical)
                        .lineLimit(2...4)
                        .textContentType(.fullStreetAddress)
                    TextField("Notes (optional)", text: $recipient.notes, axis: .vertical)

                    ForEach($recipient.products) { $line in
                        productLineEditor($line)
                    }

                    Button("Add product") {
                        recipient.products.append(ProductLineDraft())
                    }
                }
            }

            Button {
                appState.orderDraft.recipients.append(RecipientDraft())
                Haptics.light()
            } label: {
                Label("Add recipient", systemImage: "person.badge.plus")
            }
        }
    }

    private var reviewStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .studioCard()
                }

                Group {
                    labeled("Filler", appState.orderDraft.formFillerName)
                    labeled("Packages", "\(appState.orderDraft.incomingOrders.count)")
                    labeled("Recipients", "\(appState.orderDraft.recipients.count)")
                }
                .studioCard()

                Text("Products (recipients)")
                    .font(.headline)
                ForEach(appState.orderDraft.recipients) { recipient in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(recipient.name.isEmpty ? "Recipient" : recipient.name)
                            .font(.subheadline.weight(.semibold))
                        ForEach(recipient.products) { line in
                            if let product = appState.products.first(where: { $0.id == line.productId }) {
                                Text("\(product.name) × \(line.quantity)")
                                    .font(.caption)
                                    .foregroundStyle(AppTheme.muted)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .studioCard()
                }

                MoneyTotalsView(totals: draftTotals)

                Text("After submit, save your request ID. You can claim this order later if you create an account.")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.muted)
            }
            .padding()
        }
    }

    @ViewBuilder
    private func productLineEditor(_ line: Binding<ProductLineDraft>) -> some View {
        ProductPicker(productId: line.productId, products: appState.products)
        Stepper("Quantity: \(line.wrappedValue.quantity)", value: line.quantity, in: 1...99)
    }

    private var footerButtons: some View {
        HStack(spacing: 12) {
            if step > 0 {
                Button("Back") {
                    step -= 1
                    Haptics.selection()
                }
                .buttonStyle(.bordered)
            }

            if step < steps.count - 1 {
                Button("Next") {
                    if validateCurrentStep() {
                        step += 1
                        Haptics.selection()
                    } else {
                        Haptics.error()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .frame(maxWidth: .infinity)
            } else {
                Button {
                    Task { await submit() }
                } label: {
                    if isSubmitting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Submit order")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .disabled(isSubmitting)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
    }

    private var draftTotals: MoneyTotals {
        var usd = 0.0
        for recipient in appState.orderDraft.recipients {
            for line in recipient.products {
                guard let product = appState.products.first(where: { $0.id == line.productId }) else { continue }
                let unit = MoneyTotals.unitPrice(name: product.name, fallback: product.priceUsd)
                usd += unit * Double(line.quantity)
            }
        }
        usd = (usd * 100).rounded() / 100
        return MoneyTotals(usd: usd, cny: (usd * AppTheme.cnyRate * 100).rounded() / 100)
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(AppTheme.muted)
            Spacer()
            Text(value.isEmpty ? "—" : value).fontWeight(.medium)
        }
    }

    private func validateCurrentStep() -> Bool {
        switch step {
        case 0:
            return !appState.orderDraft.formFillerName.trimmingCharacters(in: .whitespaces).isEmpty
        case 1:
            return appState.orderDraft.incomingOrders.allSatisfy {
                !$0.orderNumber.isEmpty && !$0.pickupCode.isEmpty &&
                $0.products.allSatisfy { !$0.productId.isEmpty && $0.quantity > 0 }
            }
        case 2:
            return appState.orderDraft.recipients.allSatisfy {
                !$0.name.isEmpty && !$0.phone.isEmpty && !$0.address.isEmpty &&
                $0.products.allSatisfy { !$0.productId.isEmpty && $0.quantity > 0 }
            }
        default:
            return true
        }
    }

    private func submit() async {
        errorMessage = nil
        guard validateCurrentStep() else {
            errorMessage = "Please complete all required fields."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let result = try await appState.api.submitOrder(appState.orderDraft)
            submittedId = result.requestId
            appState.clearDraft()
            Haptics.success()
            showSuccess = true
        } catch {
            errorMessage = error.localizedDescription
            Haptics.error()
        }
    }
}
