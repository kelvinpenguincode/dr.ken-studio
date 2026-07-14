import { z } from "zod";

const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;

export const productLineSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  quantity: z
    .number({ error: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0"),
});

export const incomingOrderSchema = z.object({
  orderNumber: z.string().min(1, "Order / tracking number is required"),
  pickupCode: z.string().min(1, "Pickup code is required"),
  products: z
    .array(productLineSchema)
    .min(1, "Add at least one product to this incoming order"),
});

export const recipientSchema = z.object({
  name: z.string().min(1, "Recipient name is required"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Enter a valid phone number"),
  address: z.string().min(1, "Delivery address is required"),
  notes: z.string().optional(),
  products: z
    .array(productLineSchema)
    .min(1, "Add at least one product for this recipient"),
});

export const orderRequestSchema = z.object({
  formFillerName: z.string().min(1, "Form filler name is required"),
  incomingOrders: z
    .array(incomingOrderSchema)
    .min(1, "Add at least one incoming order"),
  recipients: z.array(recipientSchema).min(1, "Add at least one recipient"),
});

export type OrderRequestFormValues = z.infer<typeof orderRequestSchema>;
export type IncomingOrderFormValues = z.infer<typeof incomingOrderSchema>;
export type RecipientFormValues = z.infer<typeof recipientSchema>;
export type ProductLineFormValues = z.infer<typeof productLineSchema>;

/** Limited customer edits before processing */
export const customerUpdateSchema = z.object({
  recipients: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Recipient name is required"),
      phone: z
        .string()
        .min(1, "Phone number is required")
        .regex(phoneRegex, "Enter a valid phone number"),
      address: z.string().min(1, "Delivery address is required"),
      notes: z.string().optional(),
      products: z.array(
        z.object({
          id: z.string().optional(),
          productId: z.string().min(1, "Please select a product"),
          quantity: z
            .number()
            .int()
            .positive("Quantity must be greater than 0"),
        }),
      ),
    }),
  ),
});

export type CustomerUpdateFormValues = z.infer<typeof customerUpdateSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const adminCreateSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(120).optional(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
  permissions: z.array(z.string()).optional(),
  useCustomPermissions: z.boolean().optional(),
});

export const adminUpdateSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
  permissions: z.array(z.string()).optional(),
  useCustomPermissions: z.boolean().optional(),
  active: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
});

export const userSignupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const userLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const userProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const claimOrderSchema = z.object({
  orderNumber: z.string().min(1, "Enter a request ID or order number"),
});

export const adminLinkUserSchema = z.object({
  userEmail: z.string().email("Enter a valid user email").optional().or(z.literal("")),
  unlink: z.boolean().optional(),
});

export const adminOrderUpdateSchema = z.object({
  status: z.enum([
    "SUBMITTED",
    "REVIEWED",
    "ERROR_NEEDS_CORRECTION",
    "PROCESSING",
    "READY_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ]),
  note: z.string().optional(),
  adminNote: z.string().optional(),
  errors: z
    .array(
      z.enum([
        "MISSING_PICKUP_CODE",
        "PRODUCT_MISMATCH",
        "QUANTITY_MISMATCH",
        "INVALID_ADDRESS",
        "DUPLICATE_ORDER",
        "UNKNOWN_PRODUCT",
      ]),
    )
    .optional(),
  userEmail: z.union([z.string().email(), z.literal("")]).optional(),
  unlinkUser: z.boolean().optional(),
});

export const defaultOrderValues: OrderRequestFormValues = {
  formFillerName: "",
  incomingOrders: [
    {
      orderNumber: "",
      pickupCode: "",
      products: [{ productId: "", quantity: 1 }],
    },
  ],
  recipients: [
    {
      name: "",
      phone: "",
      address: "",
      notes: "",
      products: [{ productId: "", quantity: 1 }],
    },
  ],
};
