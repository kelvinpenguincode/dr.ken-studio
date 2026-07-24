import SwiftUI

struct OrderStatusTracker: View {
    let status: OrderStatus
    var compact: Bool = false

    private let steps: [OrderStatus] = [
        .SUBMITTED,
        .REVIEWED,
        .PROCESSING,
        .READY_FOR_DELIVERY,
        .COMPLETED,
    ]

    private let nodeSize: CGFloat = 10
    private let currentNodeSize: CGFloat = 14
    private let trackHeight: CGFloat = 3

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 12) {
            if status == .CANCELLED {
                Text("Order cancelled")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                if status == .ERROR_NEEDS_CORRECTION {
                    Text("Needs correction — update the order, then we’ll continue processing.")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.orange)
                }

                headerRow

                GeometryReader { geo in
                    let width = geo.size.width
                    let last = CGFloat(max(steps.count - 1, 1))
                    let progress = progressFraction

                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(AppTheme.border.opacity(0.85))
                            .frame(height: trackHeight)

                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [AppTheme.accent.opacity(0.75), AppTheme.accent],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(nodeSize / 2, width * progress), height: trackHeight)
                            .shadow(color: AppTheme.accent.opacity(0.35), radius: 4, y: 0)

                        ForEach(Array(steps.enumerated()), id: \.offset) { index, _ in
                            let x = width * (CGFloat(index) / last)
                            let done = isDone(index)
                            let current = isCurrent(index)
                            let size = current ? currentNodeSize : nodeSize

                            ZStack {
                                if current {
                                    Circle()
                                        .fill(nodeAccent(for: index).opacity(0.22))
                                        .frame(width: size + 10, height: size + 10)
                                }
                                Circle()
                                    .fill(done || current ? nodeAccent(for: index) : Color.white)
                                    .frame(width: size, height: size)
                                    .overlay(
                                        Circle()
                                            .strokeBorder(
                                                done || current ? nodeAccent(for: index) : AppTheme.border,
                                                lineWidth: current ? 0 : 1.5
                                            )
                                    )
                                    .shadow(
                                        color: current ? nodeAccent(for: index).opacity(0.45) : .clear,
                                        radius: 5,
                                        y: 0
                                    )
                            }
                            .position(x: x, y: geo.size.height / 2)
                        }
                    }
                }
                .frame(height: compact ? 22 : 28)

                if !compact {
                    HStack(spacing: 0) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            Text(microLabel(step))
                                .font(.system(size: 9, weight: isDone(index) || isCurrent(index) ? .semibold : .medium))
                                .foregroundStyle(
                                    isDone(index) || isCurrent(index)
                                        ? AppTheme.foreground
                                        : AppTheme.muted.opacity(0.8)
                                )
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                        }
                    }
                }
            }
        }
        .padding(.vertical, compact ? 2 : 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Order status \(status.label), step \(displayStep) of \(steps.count)")
    }

    private var headerRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(status.label)
                .font((compact ? Font.subheadline : Font.headline).weight(.semibold))
                .foregroundStyle(
                    status == .ERROR_NEEDS_CORRECTION ? Color.orange : AppTheme.foreground
                )
                .lineLimit(1)

            Spacer(minLength: 8)

            Text("\(displayStep)/\(steps.count)")
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(AppTheme.muted)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(AppTheme.creamDark.opacity(0.9), in: Capsule())
        }
    }

    private var activeIndex: Int {
        if status == .ERROR_NEEDS_CORRECTION { return 1 }
        if status == .COMPLETED { return steps.count - 1 }
        return steps.firstIndex(of: status) ?? 0
    }

    private var displayStep: Int {
        min(activeIndex + 1, steps.count)
    }

    private var progressFraction: CGFloat {
        let last = CGFloat(max(steps.count - 1, 1))
        if status == .COMPLETED { return 1 }
        return CGFloat(activeIndex) / last
    }

    private func isDone(_ index: Int) -> Bool {
        if status == .COMPLETED { return true }
        if status == .ERROR_NEEDS_CORRECTION { return index < 1 }
        return index < activeIndex
    }

    private func isCurrent(_ index: Int) -> Bool {
        if status == .COMPLETED { return index == steps.count - 1 }
        return index == activeIndex
    }

    private func nodeAccent(for index: Int) -> Color {
        if isCurrent(index) && status == .ERROR_NEEDS_CORRECTION { return .orange }
        return AppTheme.accent
    }

    private func microLabel(_ status: OrderStatus) -> String {
        switch status {
        case .SUBMITTED: return "Sent"
        case .REVIEWED: return "Review"
        case .PROCESSING: return "Work"
        case .READY_FOR_DELIVERY: return "Ready"
        case .COMPLETED: return "Done"
        default: return status.label
        }
    }
}
