import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminTeamPanel } from "@/components/admin/AdminTeamPanel";
import { hasPermission } from "@/lib/admin-permissions";
import { getAdminActor } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const actor = await getAdminActor();
  if (!actor) {
    redirect("/admin/login");
  }
  if (!hasPermission(actor.permissions, "admins.manage")) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e8_0%,#f4efe6_40%,#efe7db_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <AdminHeader
          email={actor.email}
          title="Admin team"
          subtitle="Invite admins, change roles, and adjust permissions"
          canManageAdmins
          showOrdersLink
        />
        <AdminTeamPanel currentAdminId={actor.id} currentRole={actor.role} />
      </div>
    </div>
  );
}
