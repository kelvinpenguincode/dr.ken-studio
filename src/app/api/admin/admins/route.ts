import {
  ADMIN_PERMISSIONS,
  resolvePermissions,
  type AdminPermission,
  type AdminRoleName,
} from "@/lib/admin-permissions";
import { requireAdminPermission } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { adminCreateSchema, adminUpdateSchema } from "@/lib/validations/order";
import type { AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

function sanitizePermissions(input: string[] | undefined): AdminPermission[] {
  if (!input) return [];
  return ADMIN_PERMISSIONS.filter((permission) => input.includes(permission));
}

function publicAdmin(admin: {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  permissions: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const role = admin.role as AdminRoleName;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role,
    permissions: admin.permissions,
    effectivePermissions: resolvePermissions(role, admin.permissions),
    active: admin.active,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

async function countActiveOwners(excludeId?: string) {
  return prisma.admin.count({
    where: {
      role: "OWNER",
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function GET() {
  const { actor, error } = await requireAdminPermission("admins.manage");
  if (error || !actor) return error!;

  try {
    const admins = await prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      admins: admins.map(publicAdmin),
      currentAdminId: actor.id,
      currentRole: actor.role,
      permissionCatalog: ADMIN_PERMISSIONS,
    });
  } catch (err) {
    console.error("List admins failed", err);
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("P2021") ||
      message.includes("P2022") ||
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("unknown column")
    ) {
      return NextResponse.json(
        {
          error:
            "Admin schema is out of date — run npx prisma db push so role/permissions columns exist",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Failed to load admins" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { actor, error } = await requireAdminPermission("admins.manage");
  if (error || !actor) return error!;

  try {
    const body = await request.json();
    const parsed = adminCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password, name, role, permissions, useCustomPermissions } =
      parsed.data;

    if (role === "OWNER" && actor.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can create other owners" },
        { status: 403 },
      );
    }

    const existing = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An admin with this email already exists" },
        { status: 409 },
      );
    }

    const custom =
      useCustomPermissions === true ? sanitizePermissions(permissions) : [];
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name?.trim() || null,
        role,
        permissions: custom,
        active: true,
      },
    });

    return NextResponse.json(publicAdmin(admin), { status: 201 });
  } catch (err) {
    console.error("Create admin failed", err);
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { actor, error } = await requireAdminPermission("admins.manage");
  if (error || !actor) return error!;

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "Admin id is required" }, { status: 400 });
    }

    const parsed = adminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (actor.role !== "OWNER" && target.role === "OWNER") {
      return NextResponse.json(
        { error: "Only owners can change owner accounts" },
        { status: 403 },
      );
    }

    const data = parsed.data;
    if (data.role === "OWNER" && actor.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can promote to owner" },
        { status: 403 },
      );
    }

    if (data.active === false && target.id === actor.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 },
      );
    }

    const nextRole = (data.role ?? target.role) as AdminRoleName;
    if (
      target.role === "OWNER" &&
      target.active &&
      (nextRole !== "OWNER" || data.active === false)
    ) {
      const remaining = await countActiveOwners(target.id);
      if (remaining < 1) {
        return NextResponse.json(
          { error: "Cannot remove or demote the last active owner" },
          { status: 400 },
        );
      }
    }

    let permissions = target.permissions;
    if (data.useCustomPermissions === true) {
      permissions = sanitizePermissions(data.permissions);
    } else if (data.useCustomPermissions === false) {
      permissions = [];
    } else if (data.permissions) {
      permissions = sanitizePermissions(data.permissions);
    }

    const updateData: {
      name?: string | null;
      role?: AdminRole;
      permissions?: string[];
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name?.trim() ? data.name.trim() : null;
    }
    if (data.role) updateData.role = data.role;
    if (data.useCustomPermissions !== undefined || data.permissions) {
      updateData.permissions = permissions;
    }
    if (data.active !== undefined) updateData.active = data.active;
    if (data.password && data.password.length > 0) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(publicAdmin(updated));
  } catch (err) {
    console.error("Update admin failed", err);
    return NextResponse.json({ error: "Failed to update admin" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { actor, error } = await requireAdminPermission("admins.manage");
  if (error || !actor) return error!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Admin id is required" }, { status: 400 });
    }

    if (id === actor.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (actor.role !== "OWNER" && target.role === "OWNER") {
      return NextResponse.json(
        { error: "Only owners can delete owner accounts" },
        { status: 403 },
      );
    }

    if (target.role === "OWNER" && target.active) {
      const remaining = await countActiveOwners(target.id);
      if (remaining < 1) {
        return NextResponse.json(
          { error: "Cannot delete the last active owner" },
          { status: 400 },
        );
      }
    }

    await prisma.admin.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete admin failed", err);
    return NextResponse.json({ error: "Failed to delete admin" }, { status: 500 });
  }
}
