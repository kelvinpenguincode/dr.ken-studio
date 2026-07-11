import { SearchModifyClient } from "@/components/orders/SearchModifyClient";
import { getActiveProducts } from "@/lib/services/orders";
import { findOrderByLookup } from "@/lib/services/orders";
import { isOrderEditable } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const [order, products] = await Promise.all([
    q ? findOrderByLookup(q) : null,
    getActiveProducts(),
  ]);

  return (
    <SearchModifyClient
      initialQuery={q ?? ""}
      initialOrder={order}
      editable={order ? isOrderEditable(order.status) : false}
      products={products}
    />
  );
}
