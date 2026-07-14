export const ADMIN_PERMISSIONS = [
  "orders.view",
  "orders.update",
  "orders.export",
  "reports.view",
  "admins.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminRoleName = "OWNER" | "MANAGER" | "STAFF";

export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRoleName, AdminPermission[]> = {
  OWNER: [...ADMIN_PERMISSIONS],
  MANAGER: [
    "orders.view",
    "orders.update",
    "orders.export",
    "reports.view",
    "admins.manage",
  ],
  STAFF: ["orders.view", "orders.update"],
};

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  "orders.view": "View orders",
  "orders.update": "Update order status & notes",
  "orders.export": "Export CSV",
  "reports.view": "View sales reports",
  "admins.manage": "Manage admin accounts & permissions",
};

export const ROLE_LABELS: Record<AdminRoleName, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export function resolvePermissions(
  role: AdminRoleName,
  custom: string[] | null | undefined,
): AdminPermission[] {
  if (custom && custom.length > 0) {
    return ADMIN_PERMISSIONS.filter((permission) => custom.includes(permission));
  }
  return [...ROLE_DEFAULT_PERMISSIONS[role]];
}

export function hasPermission(
  permissions: readonly string[],
  required: AdminPermission,
): boolean {
  return permissions.includes(required);
}

export function isAdminRole(value: string): value is AdminRoleName {
  return value === "OWNER" || value === "MANAGER" || value === "STAFF";
}
