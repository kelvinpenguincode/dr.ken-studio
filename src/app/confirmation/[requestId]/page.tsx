import { OrderSummary } from "@/components/orders/OrderSummary";
import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { getOrderByRequestId } from "@/lib/services/orders";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type ConfirmationPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { requestId } = await params;
  const order = await getOrderByRequestId(requestId);

  if (!order) {
    notFound();
  }

  return (
    <PageShell>
      <PageTitle>Order Submitted</PageTitle>

      <Alert variant="warning">
        Please save your request ID <strong>{order.requestId}</strong>. You will need it to
        search or modify this order later.
      </Alert>

      <OrderSummary order={order} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/search?q=${encodeURIComponent(order.requestId)}`}
          className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-accent bg-accent px-4 py-3 text-center text-base font-medium text-white"
        >
          View / modify order
        </Link>
        <Link
          href="/"
          className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-white px-4 py-3 text-center text-base font-medium text-foreground"
        >
          Submit another order
        </Link>
      </div>
    </PageShell>
  );
}
