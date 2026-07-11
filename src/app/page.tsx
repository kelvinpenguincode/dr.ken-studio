import { OrderRequestForm } from "@/components/forms/OrderRequestForm";
import { getActiveProducts } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getActiveProducts();

  return <OrderRequestForm products={products} />;
}
