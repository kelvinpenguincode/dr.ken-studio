/** USD → CNY conversion rate used across summaries and reports */
export const CNY_RATE = 6.8;

export type MoneyTotals = {
  usd: number;
  cny: number;
};

export function toMoney(amount: number): MoneyTotals {
  const usd = Math.round(amount * 100) / 100;
  const cny = Math.round(usd * CNY_RATE * 100) / 100;
  return { usd, cny };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatCny(amount: number): string {
  return `¥${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} CNY`;
}

/**
 * Product unit prices (USD). Keys match product names in the catalog.
 */
export const PRODUCT_PRICES_USD: Record<string, number> = {
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
};

export function getProductPriceUsd(name: string, fallback?: number | string | null): number {
  if (PRODUCT_PRICES_USD[name] != null) return PRODUCT_PRICES_USD[name];
  if (fallback != null) return Number(fallback);
  return 0;
}

type PricedLine = {
  quantity: number;
  product: { name: string; priceUsd?: number | string | { toString(): string } | null };
};

/** Order value is based on recipient (delivery) products. */
export function calculateOrderTotals(order: {
  recipients: Array<{ products: PricedLine[] }>;
}): MoneyTotals & { lineCount: number } {
  let usd = 0;
  let lineCount = 0;

  for (const recipient of order.recipients) {
    for (const line of recipient.products) {
      const unit = getProductPriceUsd(
        line.product.name,
        line.product.priceUsd != null ? Number(line.product.priceUsd) : null,
      );
      usd += unit * line.quantity;
      lineCount += 1;
    }
  }

  return { ...toMoney(usd), lineCount };
}
