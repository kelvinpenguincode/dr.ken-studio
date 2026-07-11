import { customAlphabet } from "nanoid";
import type { AdminErrorType, OrderStatus } from "@prisma/client";

export const REQUEST_ID_PREFIX = "FJ";

const generateId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function generateRequestId(): string {
  return `${REQUEST_ID_PREFIX}-${generateId()}`;
}

export function generateLookupToken(): string {
  return customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32)();
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  ERROR_NEEDS_CORRECTION: "Error / Needs Correction",
  PROCESSING: "Processing",
  READY_FOR_DELIVERY: "Ready for Delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ADMIN_ERROR_LABELS: Record<AdminErrorType, string> = {
  MISSING_PICKUP_CODE: "Missing pickup code",
  PRODUCT_MISMATCH: "Product mismatch",
  QUANTITY_MISMATCH: "Quantity mismatch",
  INVALID_ADDRESS: "Invalid address",
  DUPLICATE_ORDER: "Duplicate order",
  UNKNOWN_PRODUCT: "Unknown product",
};

/** Statuses where customers can still edit limited fields */
export const EDITABLE_STATUSES: OrderStatus[] = [
  "SUBMITTED",
  "REVIEWED",
  "ERROR_NEEDS_CORRECTION",
];

export function isOrderEditable(status: OrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  SUBMITTED: "bg-sky-50 text-sky-800 border-sky-200",
  REVIEWED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  ERROR_NEEDS_CORRECTION: "bg-red-50 text-red-800 border-red-200",
  PROCESSING: "bg-amber-50 text-amber-900 border-amber-200",
  READY_FOR_DELIVERY: "bg-emerald-50 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-green-50 text-green-800 border-green-200",
  CANCELLED: "bg-stone-100 text-stone-600 border-stone-200",
};

export function groupProductsByCategory(
  products: Array<{ id: string; name: string; category: string | null }>,
) {
  const groups = new Map<string, Array<{ value: string; label: string }>>();

  for (const product of products) {
    const category = product.category?.trim() || "Other";
    const existing = groups.get(category) ?? [];
    existing.push({ value: product.id, label: product.name });
    groups.set(category, existing);
  }

  return Array.from(groups.entries()).map(([label, options]) => ({
    label,
    options,
  }));
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
