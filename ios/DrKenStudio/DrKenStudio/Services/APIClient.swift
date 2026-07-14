import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case badStatus(Int, String?)
    case decoding(String)
    case empty
    case network(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .badStatus(let code, let message):
            if let message, !message.isEmpty {
                return "\(message) (\(code))"
            }
            return "Request failed (\(code))"
        case .decoding(let detail):
            return "Bad server response: \(detail)"
        case .empty:
            return "Empty response"
        case .network(let detail):
            return detail
        }
    }
}

final class APIClient {
    var baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = HTTPCookieStorage.shared
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder()
    }

    // MARK: - Products

    func fetchProducts() async throws -> [Product] {
        try await get("/api/products")
    }

    // MARK: - Auth

    func currentUser() async throws -> UserProfile? {
        let envelope: UserEnvelope = try await get("/api/auth/me")
        return envelope.user
    }

    func login(email: String, password: String) async throws -> UserProfile {
        let body = ["email": email, "password": password]
        let response: AuthResponse = try await post("/api/auth/login", json: body)
        return response.asProfile
    }

    func signup(email: String, password: String, name: String?, phone: String?, address: String?) async throws -> UserProfile {
        var body: [String: Any] = ["email": email, "password": password]
        if let name { body["name"] = name }
        if let phone { body["phone"] = phone }
        if let address { body["address"] = address }
        let response: AuthResponse = try await post("/api/auth/signup", json: body)
        return response.asProfile
    }

    func logout() async throws {
        _ = try await request(path: "/api/auth/logout", method: "DELETE", body: nil as [String: Any]?)
    }

    func updateProfile(name: String, phone: String?, address: String?) async throws -> UserProfile {
        var body: [String: Any] = ["name": name]
        body["phone"] = phone ?? ""
        body["address"] = address ?? ""
        let envelope: UserEnvelope = try await patch("/api/auth/me", json: body)
        guard let user = envelope.user else { throw APIError.empty }
        return user
    }

    // MARK: - Orders

    func submitOrder(_ draft: OrderDraft) async throws -> SubmitOrderResponse {
        try await post("/api/orders", json: draft.toAPIBody())
    }

    func searchOrder(query: String) async throws -> OrderDetail {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await get("/api/orders/search?q=\(encoded)")
    }

    func getOrder(requestId: String) async throws -> OrderDetail {
        let encoded = requestId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? requestId
        return try await get("/api/orders/\(encoded)")
    }

    func myOrders() async throws -> [OrderDetail] {
        try await get("/api/account/orders")
    }

    func claimOrder(orderNumber: String) async throws -> OrderDetail {
        try await post("/api/account/orders", json: ["orderNumber": orderNumber])
    }

    func updateOrder(requestId: String, recipients: [[String: Any]]) async throws -> OrderDetail {
        let encoded = requestId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? requestId
        return try await patch("/api/orders/\(encoded)", json: ["recipients": recipients])
    }

    // MARK: - Push

    func registerPushToken(token: String, requestId: String?) async throws {
        var body: [String: Any] = [
            "token": token,
            "platform": "ios",
        ]
        if let requestId, !requestId.isEmpty {
            body["requestId"] = requestId
        }
        struct Ok: Decodable { let ok: Bool? }
        let _: Ok = try await post("/api/push/register", json: body)
    }

    func unregisterPushToken(_ token: String) async throws {
        _ = try await request(path: "/api/push/register", method: "DELETE", body: ["token": token])
    }

    // MARK: - HTTP helpers

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let data = try await request(path: path, method: "GET", body: nil as [String: Any]?)
        return try decode(data)
    }

    private func post<T: Decodable>(_ path: String, json: [String: Any]) async throws -> T {
        let data = try await request(path: path, method: "POST", body: json)
        return try decode(data)
    }

    private func patch<T: Decodable>(_ path: String, json: [String: Any]) async throws -> T {
        let data = try await request(path: path, method: "PATCH", body: json)
        return try decode(data)
    }

    private func request(path: String, method: String, body: [String: Any]?) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.empty }

        if !(200...299).contains(http.statusCode) {
            var message: String?
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let error = json["error"] as? String
                let hint = json["hint"] as? String
                let detail = json["detail"] as? String
                message = [error, hint, detail]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " — ")
            }
            if message == nil, let text = String(data: data, encoding: .utf8), !text.isEmpty {
                // HTML or plain text from Vercel / Next (often a missing route)
                let trimmed = text
                    .replacingOccurrences(of: "\n", with: " ")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                message = String(trimmed.prefix(120))
            }
            throw APIError.badStatus(http.statusCode, message)
        }
        return data
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            let preview = String(data: data, encoding: .utf8).map { String($0.prefix(80)) } ?? "unknown"
            throw APIError.decoding(preview)
        }
    }
}
