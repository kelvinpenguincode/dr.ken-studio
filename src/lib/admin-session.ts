import {
  hasPermission,
  resolvePermissions,
  type AdminPermission,
  type AdminRoleName,
} from "@/lib/admin-permissions";
import { getAdminSessionCookieName, parseAdminSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function getAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  return parseAdminSessionToken(token);
}

export type AdminActor = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRoleName;
  permissions: AdminPermission[];
  active: boolean;
};

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await getAdminSessionFromCookies();
  if (!session) return null;

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
    });

    if (!admin || !admin.active) return null;

    const role = (admin.role as AdminRoleName | undefined) ?? "OWNER";
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role,
      permissions: resolvePermissions(role, admin.permissions ?? []),
      active: admin.active,
    };
  } catch (error) {
    console.error("getAdminActor failed", error);
    return null;
  }
}

export async function requireAdminPermission(permission: AdminPermission) {
  const actor = await getAdminActor();
  if (!actor) {
    return {
      actor: null as AdminActor | null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermission(actor.permissions, permission)) {
    return {
      actor,
      error: NextResponse.json(
        { error: "You do not have permission for this action" },
        { status: 403 },
      ),
    };
  }
  return { actor, error: null };
}
