import { prisma } from "@/lib/prisma";
import { generateLookupToken, generateRequestId } from "@/lib/utils";
import type { CustomerUpdateFormValues, OrderRequestFormValues } from "@/lib/validations/order";
import { orderDetailInclude, type OrderDetail } from "@/types/order";
import type { AdminErrorType, OrderStatus, Prisma } from "@prisma/client";

export async function getActiveProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        priceUsd: true,
      },
    });

    return products.map((product) => ({
      ...product,
      priceUsd: Number(product.priceUsd),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Older DBs may be missing price_usd / sort_order until prisma db push
    if (
      message.includes("P2022") ||
      message.includes("price_usd") ||
      message.includes("sort_order") ||
      message.toLowerCase().includes("does not exist")
    ) {
      const products = await prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, description: true },
      });
      return products.map((product) => ({
        ...product,
        priceUsd: 0,
      }));
    }
    throw error;
  }
}

export async function getAdminOrderStats() {
  const groups = await prisma.orderRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(
    groups.map((group) => [group.status, group._count._all]),
  ) as Partial<Record<OrderStatus, number>>;

  const total = groups.reduce((sum, group) => sum + group._count._all, 0);

  return { total, byStatus };
}

export async function createOrderRequest(
  data: OrderRequestFormValues,
  userId?: string | null,
) {
  const requestId = generateRequestId();
  const lookupToken = generateLookupToken();

  return prisma.$transaction(async (tx) => {
    const order = await tx.orderRequest.create({
      data: {
        requestId,
        lookupToken,
        formFillerName: data.formFillerName,
        status: "SUBMITTED",
        userId: userId ?? null,
        incomingOrders: {
          create: data.incomingOrders.map((incoming, index) => ({
            orderNumber: incoming.orderNumber.trim(),
            pickupCode: incoming.pickupCode.trim(),
            sortOrder: index,
            products: {
              create: incoming.products.map((product) => ({
                productId: product.productId,
                quantity: product.quantity,
              })),
            },
          })),
        },
        recipients: {
          create: data.recipients.map((recipient, index) => ({
            name: recipient.name.trim(),
            phone: recipient.phone.trim(),
            address: recipient.address.trim(),
            notes: recipient.notes?.trim() || null,
            sortOrder: index,
            products: {
              create: recipient.products.map((product) => ({
                productId: product.productId,
                quantity: product.quantity,
              })),
            },
          })),
        },
        statusHistory: {
          create: {
            status: "SUBMITTED",
            changedBy: userId ? "customer-account" : "customer",
            note: "Order submitted",
          },
        },
      },
      include: orderDetailInclude,
    });

    return order;
  });
}

export async function findOrderByLookup(query: string): Promise<OrderDetail | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  return prisma.orderRequest.findFirst({
    where: {
      OR: [
        { requestId: { equals: trimmed, mode: "insensitive" } },
        { lookupToken: trimmed },
        {
          incomingOrders: {
            some: {
              orderNumber: { equals: trimmed, mode: "insensitive" },
            },
          },
        },
      ],
    },
    include: orderDetailInclude,
  });
}

export async function getOrderByRequestId(requestId: string): Promise<OrderDetail | null> {
  return prisma.orderRequest.findUnique({
    where: { requestId },
    include: orderDetailInclude,
  });
}

export async function updateCustomerOrder(
  requestId: string,
  data: CustomerUpdateFormValues,
): Promise<OrderDetail> {
  const existing = await getOrderByRequestId(requestId);
  if (!existing) {
    throw new Error("Order not found");
  }

  if (!["SUBMITTED", "REVIEWED", "ERROR_NEEDS_CORRECTION"].includes(existing.status)) {
    throw new Error("This order can no longer be edited");
  }

  return prisma.$transaction(async (tx) => {
    for (const recipient of data.recipients) {
      if (!recipient.id) continue;

      await tx.recipient.update({
        where: { id: recipient.id },
        data: {
          name: recipient.name.trim(),
          phone: recipient.phone.trim(),
          address: recipient.address.trim(),
          notes: recipient.notes?.trim() || null,
        },
      });

      for (const product of recipient.products) {
        if (!product.id) continue;
        await tx.recipientProduct.update({
          where: { id: product.id },
          data: {
            productId: product.productId,
            quantity: product.quantity,
          },
        });
      }
    }

    return tx.orderRequest.findUniqueOrThrow({
      where: { requestId },
      include: orderDetailInclude,
    });
  });
}

export type AdminOrderFilters = {
  q?: string;
  status?: OrderStatus;
  productId?: string;
};

export async function listOrdersForAdmin(filters: AdminOrderFilters) {
  const where: Prisma.OrderRequestWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.productId) {
    where.OR = [
      {
        incomingOrders: {
          some: {
            products: { some: { productId: filters.productId } },
          },
        },
      },
      {
        recipients: {
          some: {
            products: { some: { productId: filters.productId } },
          },
        },
      },
    ];
  }

  if (filters.q) {
    const q = filters.q.trim();
    const searchConditions: Prisma.OrderRequestWhereInput[] = [
      { requestId: { contains: q, mode: "insensitive" } },
      { formFillerName: { contains: q, mode: "insensitive" } },
      {
        incomingOrders: {
          some: { orderNumber: { contains: q, mode: "insensitive" } },
        },
      },
      {
        recipients: {
          some: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];

    where.AND = [
      ...(where.OR ? [{ OR: where.OR }] : []),
      { OR: searchConditions },
    ];
    delete where.OR;
  }

  return prisma.orderRequest.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, name: true } },
      incomingOrders: {
        include: { products: { include: { product: true } } },
      },
      recipients: {
        include: { products: { include: { product: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOrdersForUser(userId: string) {
  return prisma.orderRequest.findMany({
    where: { userId },
    include: orderDetailInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function claimOrderForUser(userId: string, orderNumber: string) {
  const trimmed = orderNumber.trim();
  const order = await prisma.orderRequest.findFirst({
    where: {
      OR: [
        { requestId: { equals: trimmed, mode: "insensitive" } },
        {
          incomingOrders: {
            some: { orderNumber: { equals: trimmed, mode: "insensitive" } },
          },
        },
      ],
    },
  });

  if (!order) {
    throw new Error("No matching order found");
  }

  if (order.userId && order.userId !== userId) {
    throw new Error("This order is already linked to another account");
  }

  if (order.userId === userId) {
    return getOrderByRequestId(order.requestId);
  }

  return prisma.orderRequest.update({
    where: { id: order.id },
    data: { userId },
    include: orderDetailInclude,
  });
}

export async function linkOrderToUserByEmail(
  requestId: string,
  userEmail: string | null,
  unlink = false,
) {
  if (unlink || !userEmail) {
    return prisma.orderRequest.update({
      where: { requestId },
      data: { userId: null },
      include: orderDetailInclude,
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
  });

  if (!user) {
    throw new Error("No user found with that email");
  }

  return prisma.orderRequest.update({
    where: { requestId },
    data: { userId: user.id },
    include: orderDetailInclude,
  });
}

export async function generateSalesReport(filters: AdminOrderFilters & {
  from?: string;
  to?: string;
}) {
  const where: Prisma.OrderRequestWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const orders = await prisma.orderRequest.findMany({
    where,
    include: {
      recipients: {
        include: { products: { include: { product: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const productTotals = new Map<
    string,
    { name: string; quantity: number; unitPrice: number; revenue: number }
  >();

  let grandUsd = 0;

  for (const order of orders) {
    for (const recipient of order.recipients) {
      for (const line of recipient.products) {
        const unit = Number(line.product.priceUsd);
        const revenue = unit * line.quantity;
        grandUsd += revenue;
        const existing = productTotals.get(line.productId);
        if (existing) {
          existing.quantity += line.quantity;
          existing.revenue += revenue;
        } else {
          productTotals.set(line.productId, {
            name: line.product.name,
            quantity: line.quantity,
            unitPrice: unit,
            revenue,
          });
        }
      }
    }
  }

  return {
    orderCount: orders.length,
    products: Array.from(productTotals.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    totalUsd: Math.round(grandUsd * 100) / 100,
    totalCny: Math.round(grandUsd * 6.8 * 100) / 100,
    orders: orders.map((order) => ({
      requestId: order.requestId,
      status: order.status,
      createdAt: order.createdAt,
      formFillerName: order.formFillerName,
    })),
  };
}

export async function updateOrderAsAdmin(
  requestId: string,
  payload: {
    status: OrderStatus;
    note?: string;
    adminNote?: string;
    errors?: AdminErrorType[];
    adminEmail: string;
    adminId: string;
    userEmail?: string;
    unlinkUser?: boolean;
  },
) {
  const previous = await prisma.orderRequest.findUnique({
    where: { requestId },
  });
  if (!previous) {
    throw new Error("Order not found");
  }

  const order = await prisma.$transaction(async (tx) => {
    let userId: string | null | undefined = undefined;
    if (payload.unlinkUser) {
      userId = null;
    } else if (payload.userEmail?.trim()) {
      const user = await tx.user.findUnique({
        where: { email: payload.userEmail.trim().toLowerCase() },
      });
      if (!user) {
        throw new Error("No user found with that email");
      }
      userId = user.id;
    }

    const updated = await tx.orderRequest.update({
      where: { requestId },
      data: {
        status: payload.status,
        ...(userId !== undefined ? { userId } : {}),
      },
      include: orderDetailInclude,
    });

    if (previous.status !== payload.status) {
      await tx.orderStatusHistory.create({
        data: {
          orderRequestId: updated.id,
          status: payload.status,
          changedBy: payload.adminEmail,
          note: payload.note ?? `Status changed to ${payload.status}`,
        },
      });
    }

    if (payload.adminNote?.trim()) {
      await tx.adminNote.create({
        data: {
          orderRequestId: updated.id,
          adminId: payload.adminId,
          content: payload.adminNote.trim(),
        },
      });
    }

    if (payload.errors) {
      await tx.orderAdminError.deleteMany({
        where: { orderRequestId: updated.id },
      });

      if (payload.errors.length > 0) {
        await tx.orderAdminError.createMany({
          data: payload.errors.map((errorType) => ({
            orderRequestId: updated.id,
            errorType,
          })),
        });
      }
    }

    return tx.orderRequest.findUniqueOrThrow({
      where: { requestId },
      include: orderDetailInclude,
    });
  });

  if (previous.status !== payload.status) {
    const { notifyOrderStatusChange } = await import("@/lib/services/push");
    // Await so Vercel serverless does not freeze before APNs finishes
    try {
      const result = await notifyOrderStatusChange(
        order.requestId,
        order.status,
        order.userId,
      );
      console.info("[push] status notify result", result);
    } catch (error) {
      console.error("[push] status notify failed", error);
    }
  }

  return order;
}

export async function exportOrdersToCsv(filters: AdminOrderFilters) {
  const orders = await listOrdersForAdmin(filters);

  const headers = [
    "Request ID",
    "Status",
    "Form Filler",
    "Submitted At",
    "Incoming Orders",
    "Recipients",
    "Recipient Phones",
    "Products",
  ];

  const rows = orders.map((order) => {
    const incoming = order.incomingOrders
      .map((item) => `${item.orderNumber} (${item.pickupCode})`)
      .join("; ");
    const recipients = order.recipients.map((r) => r.name).join("; ");
    const phones = order.recipients.map((r) => r.phone).join("; ");
    const products = [
      ...order.incomingOrders.flatMap((item) =>
        item.products.map((p) => `${p.product.name} x${p.quantity}`),
      ),
    ].join("; ");

    return [
      order.requestId,
      order.status,
      order.formFillerName,
      order.createdAt.toISOString(),
      incoming,
      recipients,
      phones,
      products,
    ];
  });

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
