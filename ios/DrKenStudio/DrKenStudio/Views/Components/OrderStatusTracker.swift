import SwiftUI

struct OrderStatusTracker: View {
    let status: OrderStatus

    private let steps: [OrderStatus] = [
        .SUBMITTED,
        .REVIEWED,
        .PROCESSING,
        .READY_FOR_DELIVERY,
        .COMPLETED,
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if status == .CANCELLED {
                Text("Order cancelled")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                if status == .ERROR_NEEDS_CORRECTION {
                    Text("Needs correction — update the order, then we’ll continue processing.")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.orange)
                }

                GeometryReader { geo in
                    let count = CGFloat(steps.count)
                    let spacing = geo.size.width / count

                    ZStack(alignment: .leading) {
                        // Base line
                        Capsule()
                            .fill(AppTheme.border)
                            .frame(height: 3)
                            .padding(.horizontal, spacing / 2)
                            .offset(y: 14)

                        // Progress line
                        Capsule()
                            .fill(AppTheme.accent)
                            .frame(width: max(0, progressWidth(totalWidth: geo.size.width)), height: 3)
                            .padding(.leading, spacing / 2)
                            .offset(y: 14)

                        HStack(spacing: 0) {
                            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                                VStack(spacing: 8) {
                                    ZStack {
                                        Circle()
                                            .fill(circleFill(for: index))
                                            .frame(width: 28, height: 28)
                                        Circle()
                                            .strokeBorder(circleStroke(for: index), lineWidth: 2)
                                            .frame(width: 28, height: 28)
                                        if isDone(index) {
                                            Image(systemName: "checkmark")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(.white)
                                        } else {
                                            Text("\(index + 1)")
                                                .font(.caption2.weight(.bold))
                                                .foregroundStyle(isCurrent(index) ? AppTheme.accent : AppTheme.muted)
                                        }
                                    }
                                    Text(shortLabel(step))
                                        .font(.caption2.weight(isDone(index) || isCurrent(index) ? .semibold : .regular))
                                        .foregroundStyle(isDone(index) || isCurrent(index) ? AppTheme.foreground : AppTheme.muted)
                                        .multilineTextAlignment(.center)
                                        .frame(width: spacing - 4)
                                }
                                .frame(width: spacing)
                            }
                        }
                    }
                }
                .frame(height: 70)

                Text("Current status: \(status.label)")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
    }

    private var activeIndex: Int {
        if status == .ERROR_NEEDS_CORRECTION { return 1 }
        if status == .COMPLETED { return steps.count - 1 }
        return steps.firstIndex(of: status) ?? 0
    }

    private func isDone(_ index: Int) -> Bool {
        if status == .COMPLETED { return true }
        if status == .ERROR_NEEDS_CORRECTION { return index < 1 }
        return index < activeIndex
    }

    private func isCurrent(_ index: Int) -> Bool {
        if status == .COMPLETED { return false }
        return index == activeIndex
    }

    private func circleFill(for index: Int) -> Color {
        if isDone(index) { return AppTheme.accent }
        if isCurrent(index) && status == .ERROR_NEEDS_CORRECTION { return .orange }
        return .white
    }

    private func circleStroke(for index: Int) -> Color {
        if isDone(index) { return AppTheme.accent }
        if isCurrent(index) {
            return status == .ERROR_NEEDS_CORRECTION ? .orange : AppTheme.accent
        }
        return AppTheme.border
    }

    private func progressWidth(totalWidth: CGFloat) -> CGFloat {
        let count = CGFloat(steps.count)
        let spacing = totalWidth / count
        let progressIndex = status == .COMPLETED ? count - 1 : CGFloat(activeIndex)
        return progressIndex * spacing
    }

    private func shortLabel(_ status: OrderStatus) -> String {
        switch status {
        case .READY_FOR_DELIVERY: return "Ready"
        case .ERROR_NEEDS_CORRECTION: return "Fix"
        default: return status.label
        }
    }
}
