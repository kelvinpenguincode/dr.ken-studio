import type { Prisma } from "@prisma/client";

/** Shared Prisma include for full order details */
export const orderDetailInclude = {
  incomingOrders: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      products: {
        include: { product: true },
      },
    },
  },
  recipients: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      products: {
        include: { product: true },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "desc" as const },
  },
  adminNotes: {
    orderBy: { createdAt: "desc" as const },
    include: { admin: { select: { name: true, email: true } } },
  },
  adminErrors: {
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.OrderRequestInclude;

export type OrderDetail = Prisma.OrderRequestGetPayload<{
  include: typeof orderDetailInclude;
}>;

export type ProductOption = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};
