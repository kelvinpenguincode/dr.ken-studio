import Foundation

struct Product: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let category: String?
    let description: String?
    let priceUsd: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, category, description, priceUsd
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        if let d = try? c.decode(Double.self, forKey: .priceUsd) {
            priceUsd = d
        } else if let s = try? c.decode(String.self, forKey: .priceUsd) {
            priceUsd = Double(s)
        } else {
            priceUsd = nil
        }
    }
}

struct UserProfile: Identifiable, Codable, Equatable {
    let id: String
    let email: String
    var name: String?
    var phone: String?
    var address: String?
}

struct UserEnvelope: Codable {
    let user: UserProfile?
}

struct AuthResponse: Codable {
    let id: String
    let email: String
    let name: String?
    let phone: String?
    let address: String?

    var asProfile: UserProfile {
        UserProfile(id: id, email: email, name: name, phone: phone, address: address)
    }
}

struct SubmitOrderResponse: Codable {
    let requestId: String
    let lookupToken: String?
    let status: String?
}

enum OrderStatus: String, Codable, CaseIterable {
    case SUBMITTED
    case REVIEWED
    case ERROR_NEEDS_CORRECTION
    case PROCESSING
    case READY_FOR_DELIVERY
    case COMPLETED
    case CANCELLED

    var label: String {
        switch self {
        case .SUBMITTED: return "Submitted"
        case .REVIEWED: return "Reviewed"
        case .ERROR_NEEDS_CORRECTION: return "Needs Correction"
        case .PROCESSING: return "Processing"
        case .READY_FOR_DELIVERY: return "Ready for Delivery"
        case .COMPLETED: return "Completed"
        case .CANCELLED: return "Cancelled"
        }
    }

    var isEditable: Bool {
        [.SUBMITTED, .REVIEWED, .ERROR_NEEDS_CORRECTION].contains(self)
    }

    var isCurrent: Bool {
        ![.COMPLETED, .CANCELLED].contains(self)
    }
}

struct OrderDetail: Identifiable, Codable {
    let id: String
    let requestId: String
    let formFillerName: String
    let status: OrderStatus
    let createdAt: String
    let user: UserProfile?
    let incomingOrders: [IncomingOrderDetail]
    let recipients: [RecipientDetail]
    let adminErrors: [AdminErrorItem]?

    var totals: MoneyTotals {
        MoneyTotals.calculate(from: recipients)
    }
}

struct IncomingOrderDetail: Identifiable, Codable {
    let id: String
    let orderNumber: String
    let pickupCode: String
    let products: [OrderProductLine]
}

struct RecipientDetail: Identifiable, Codable {
    let id: String
    let name: String
    let phone: String
    let address: String
    let notes: String?
    let products: [OrderProductLine]
}

struct OrderProductLine: Identifiable, Codable {
    let id: String
    let productId: String
    let quantity: Int
    let product: NamedProduct
}

struct NamedProduct: Codable {
    let name: String
    let priceUsd: Double?

    enum CodingKeys: String, CodingKey { case name, priceUsd }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        if let d = try? c.decode(Double.self, forKey: .priceUsd) {
            priceUsd = d
        } else if let s = try? c.decode(String.self, forKey: .priceUsd) {
            priceUsd = Double(s)
        } else {
            priceUsd = nil
        }
    }
}

struct AdminErrorItem: Identifiable, Codable {
    let id: String
    let errorType: String
}

struct MoneyTotals {
    let usd: Double
    let cny: Double

    static let prices: [String: Double] = [
        "brān® - Chocolate Mint": 99.95,
        "uüth® - Superberry": 99.95,
        "plôs® THERMO - Mocha": 99.95,
        "Reserve® v2.0 Limited Edition": 109.95,
        "AM Essentials® v2.0 - Caplets": 59.95,
        "PM Essentials® v2.0 - Caplets": 59.95,
        "Luminesce® v2.0 - Cleanser": 44.95,
        "Luminesce® v2.0 - Daily Moisturizer": 69.95,
        "Luminesce® v2.0 - Body Renewal": 64.95,
        "Luminesce® v2.0 - Night Repair": 89.85,
        "Luminesce® v2.0 - Serum": 109.95,
        "Finiti® v2.0": 109.95,
        "RevitaBLŪ® v2.0": 109.95,
        "M1ND™ v2.0": 109.95,
        "L1FE NMN® v2.0": 179.95,
        "m·mūn 365®": 109.95,
        "(M)mūn™ Powder Supplement": 59.95,
        "tuün® RESONATE - Black": 99.95,
        "tuün® RESONATE - Rose Gold": 99.95,
        "tuün® RESONATE - Swarovski Diamonds": 499.95,
    ]

    static func unitPrice(name: String, fallback: Double?) -> Double {
        prices[name] ?? fallback ?? 0
    }

    static func calculate(from recipients: [RecipientDetail]) -> MoneyTotals {
        var usd = 0.0
        for recipient in recipients {
            for line in recipient.products {
                let unit = unitPrice(name: line.product.name, fallback: line.product.priceUsd)
                usd += unit * Double(line.quantity)
            }
        }
        usd = (usd * 100).rounded() / 100
        let cny = (usd * AppTheme.cnyRate * 100).rounded() / 100
        return MoneyTotals(usd: usd, cny: cny)
    }

    var usdText: String {
        String(format: "$%.2f USD", usd)
    }

    var cnyText: String {
        String(format: "¥%.2f CNY", cny)
    }
}

// MARK: - Local draft (multi-step form)

struct ProductLineDraft: Identifiable, Codable, Equatable {
    var id = UUID().uuidString
    var productId: String = ""
    var quantity: Int = 1
}

struct IncomingDraft: Identifiable, Codable, Equatable {
    var id = UUID().uuidString
    var orderNumber: String = ""
    var pickupCode: String = ""
    var products: [ProductLineDraft] = [ProductLineDraft()]
}

struct RecipientDraft: Identifiable, Codable, Equatable {
    var id = UUID().uuidString
    var name: String = ""
    var phone: String = ""
    var address: String = ""
    var notes: String = ""
    var products: [ProductLineDraft] = [ProductLineDraft()]
}

struct OrderDraft: Codable, Equatable {
    var formFillerName: String = ""
    var incomingOrders: [IncomingDraft] = [IncomingDraft()]
    var recipients: [RecipientDraft] = [RecipientDraft()]

    static let empty = OrderDraft()

    func toAPIBody() -> [String: Any] {
        [
            "formFillerName": formFillerName,
            "incomingOrders": incomingOrders.map { incoming in
                [
                    "orderNumber": incoming.orderNumber,
                    "pickupCode": incoming.pickupCode,
                    "products": incoming.products.map {
                        ["productId": $0.productId, "quantity": $0.quantity] as [String: Any]
                    },
                ] as [String: Any]
            },
            "recipients": recipients.map { recipient in
                [
                    "name": recipient.name,
                    "phone": recipient.phone,
                    "address": recipient.address,
                    "notes": recipient.notes,
                    "products": recipient.products.map {
                        ["productId": $0.productId, "quantity": $0.quantity] as [String: Any]
                    },
                ] as [String: Any]
            },
        ]
    }
}

enum OrderDraftStore {
    private static let key = "orderDraft.v1"

    static func save(_ draft: OrderDraft) {
        if let data = try? JSONEncoder().encode(draft) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func load() -> OrderDraft? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(OrderDraft.self, from: data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
