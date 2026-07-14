import { getAdminActor } from "@/lib/admin-session";
import { NextResponse } from "next/server";

export async function GET() {
  const actor = await getAdminActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: actor.id,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    permissions: actor.permissions,
  });
}
