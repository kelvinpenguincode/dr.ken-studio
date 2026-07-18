import Foundation
import MachO

/// Push-environment diagnostics for the installed build.
enum PushBuildDiagnostics {
    /// Codesign / profile only. Info.plist is NOT trusted (Release builds always
    /// stamp “production” there even when Mach-O can’t be read under FairPlay).
    static var apsEnvironment: String {
        if let signed = apsEnvironmentFromMachO() {
            return signed
        }
        if let fromProfile = apsEnvironmentFromMobileProvision() {
            return fromProfile
        }
        #if DEBUG
        return "development"
        #else
        if isTestFlightInstall {
            return "testflight-unreadable"
        }
        return "release-build-unknown"
        #endif
    }

    static var isTestFlightInstall: Bool {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }

    static var versionLabel: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        let channel = isTestFlightInstall
            ? "TestFlight"
            : (Bundle.main.appStoreReceiptURL != nil ? "App Store" : "Dev/sideload")
        return "\(version) (\(build)) · \(channel)"
    }

    private static func apsEnvironmentFromMachO() -> String? {
        guard let entitlements = embeddedEntitlements(),
              let env = entitlements["aps-environment"] as? String,
              !env.isEmpty
        else {
            return nil
        }
        return env
    }

    private static func embeddedEntitlements() -> [String: Any]? {
        guard let exe = Bundle.main.executableURL,
              let data = try? Data(contentsOf: exe)
        else {
            return nil
        }
        return entitlementsPlist(fromMachO: data)
    }

    /// Reads CSSLOT_ENTITLEMENTS from a thin arm64 Mach-O (TestFlight / device builds).
    private static func entitlementsPlist(fromMachO data: Data) -> [String: Any]? {
        guard data.count > MemoryLayout<mach_header_64>.size else { return nil }

        return data.withUnsafeBytes { raw -> [String: Any]? in
            guard let base = raw.bindMemory(to: UInt8.self).baseAddress else { return nil }
            let magic = base.withMemoryRebound(to: UInt32.self, capacity: 1) { $0.pointee }
            // Device / TestFlight builds are arm64 little-endian.
            guard magic == MH_MAGIC_64 else { return nil }

            let header = base.withMemoryRebound(to: mach_header_64.self, capacity: 1) { $0.pointee }
            var offset = MemoryLayout<mach_header_64>.size

            for _ in 0..<header.ncmds {
                guard offset + MemoryLayout<load_command>.size <= data.count else { return nil }
                let lc = base.advanced(by: offset).withMemoryRebound(to: load_command.self, capacity: 1) {
                    $0.pointee
                }
                if lc.cmd == LC_CODE_SIGNATURE {
                    guard offset + MemoryLayout<linkedit_data_command>.size <= data.count else {
                        return nil
                    }
                    let linkedit = base.advanced(by: offset).withMemoryRebound(
                        to: linkedit_data_command.self,
                        capacity: 1
                    ) { $0.pointee }
                    return parseCodeSignature(
                        base: base,
                        fileSize: data.count,
                        dataOff: Int(linkedit.dataoff),
                        dataSize: Int(linkedit.datasize)
                    )
                }
                offset += Int(lc.cmdsize)
            }
            return nil
        }
    }

    private static func parseCodeSignature(
        base: UnsafePointer<UInt8>,
        fileSize: Int,
        dataOff: Int,
        dataSize: Int
    ) -> [String: Any]? {
        guard dataOff >= 0, dataSize >= 12, dataOff + dataSize <= fileSize else { return nil }
        let cs = base.advanced(by: dataOff)
        // CSMAGIC_EMBEDDED_SIGNATURE
        guard readU32BE(cs) == 0xFADE_0CC0 else { return nil }
        let count = Int(readU32BE(cs.advanced(by: 8)))
        guard count > 0, count < 64 else { return nil }

        for i in 0..<count {
            let indexOff = 12 + i * 8
            guard indexOff + 8 <= dataSize else { continue }
            let type = readU32BE(cs.advanced(by: indexOff))
            let blobOffset = Int(readU32BE(cs.advanced(by: indexOff + 4)))
            // CSSLOT_ENTITLEMENTS
            guard type == 5 else { continue }
            guard blobOffset >= 0, blobOffset + 8 <= dataSize else { continue }
            let blob = cs.advanced(by: blobOffset)
            // CSMAGIC_EMBEDDED_ENTITLEMENTS
            guard readU32BE(blob) == 0xFADE_7171 else { continue }
            let blobLength = Int(readU32BE(blob.advanced(by: 4)))
            guard blobLength > 8, blobOffset + blobLength <= dataSize else { continue }
            let plistData = Data(bytes: blob.advanced(by: 8), count: blobLength - 8)
            return (try? PropertyListSerialization.propertyList(
                from: plistData,
                options: [],
                format: nil
            )) as? [String: Any]
        }
        return nil
    }

    private static func readU32BE(_ ptr: UnsafePointer<UInt8>) -> UInt32 {
        (UInt32(ptr[0]) << 24) | (UInt32(ptr[1]) << 16) | (UInt32(ptr[2]) << 8) | UInt32(ptr[3])
    }

    private static func apsEnvironmentFromMobileProvision() -> String? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let text = String(data: data, encoding: .ascii) ?? String(data: data, encoding: .utf8)
        else {
            return nil
        }

        guard let start = text.range(of: "<?xml"),
              let end = text.range(of: "</plist>")
        else {
            return nil
        }

        let xml = String(text[start.lowerBound..<end.upperBound])
        guard let plistData = xml.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(
                  from: plistData,
                  options: [],
                  format: nil
              ) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any],
              let env = entitlements["aps-environment"] as? String
        else {
            return nil
        }

        return env
    }
}
