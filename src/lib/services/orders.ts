import { prisma } from "@/lib/prisma";
import { generateLookupToken, generateRequestId } from "@/lib/utils";
import type { CustomerUpdateFormValues, OrderRequestFormValues } from "@/lib/validations/order";
import { orderDetailInclude, type OrderDetail } from "@/types/order";
import type { AdminErrorType, OrderStatus, Prisma } from "@prisma/client";

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, description: true },
  });
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

export async function createOrderRequest(data: OrderRequestFormValues) {
  const requestId = generateRequestId();
  const lookupToken = generateLookupToken();

  return prisma.$transaction(async (tx) => {
    const order = await tx.orderRequest.create({
      data: {
        requestId,
        lookupToken,
        formFillerName: data.formFillerName,
        status: "SUBMITTED",
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
            changedBy: "customer",
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
      incomingOrders: {
        include: { products: { include: { product: true } } },
      },
      recipients: true,
    },
    orderBy: { createdAt: "desc" },
  });
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
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.orderRequest.findUnique({
      where: { requestId },
    });

    if (!existing) {
      throw new Error("Order not found");
    }

    const order = await tx.orderRequest.update({
      where: { requestId },
      data: { status: payload.status },
      include: orderDetailInclude,
    });

    if (existing.status !== payload.status) {
      await tx.orderStatusHistory.create({
        data: {
          orderRequestId: order.id,
          status: payload.status,
          changedBy: payload.adminEmail,
          note: payload.note ?? `Status changed to ${payload.status}`,
        },
      });
    }

    if (payload.adminNote?.trim()) {
      await tx.adminNote.create({
        data: {
          orderRequestId: order.id,
          adminId: payload.adminId,
          content: payload.adminNote.trim(),
        },
      });
    }

    if (payload.errors) {
      await tx.orderAdminError.deleteMany({
        where: { orderRequestId: order.id },
      });

      if (payload.errors.length > 0) {
        await tx.orderAdminError.createMany({
          data: payload.errors.map((errorType) => ({
            orderRequestId: order.id,
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
