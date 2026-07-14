export const ORDER_DRAFT_KEY = "drken_order_draft";

export function saveOrderDraft(values: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(values));
  } catch {
    // ignore quota errors
  }
}

export function loadOrderDraft<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDER_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearOrderDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ORDER_DRAFT_KEY);
}
