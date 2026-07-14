"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ADMIN_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS,
  type AdminPermission,
  type AdminRoleName,
} from "@/lib/admin-permissions";
import { errorFromResponse, readResponseJson } from "@/lib/http";
import { useCallback, useEffect, useState } from "react";

type AdminRow = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRoleName;
  permissions: string[];
  effectivePermissions: AdminPermission[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  email: "",
  password: "",
  name: "",
  role: "STAFF" as AdminRoleName,
  useCustomPermissions: false,
  permissions: [] as AdminPermission[],
};

export function AdminTeamPanel({
  currentAdminId,
  currentRole,
}: {
  currentAdminId: string;
  currentRole: AdminRoleName;
}) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pushStatus, setPushStatus] = useState<{
    configured: boolean;
    production: boolean;
    tokenCount: number;
    hint: string;
    bundleId: string | null;
  } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "STAFF" as AdminRoleName,
    password: "",
    active: true,
    useCustomPermissions: false,
    permissions: [] as AdminPermission[],
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [adminsRes, pushRes] = await Promise.all([
        fetch("/api/admin/admins"),
        fetch("/api/admin/push-status"),
      ]);
      const data = await readResponseJson<{
        admins?: AdminRow[];
        error?: string;
      }>(adminsRes);
      if (!adminsRes.ok) {
        throw new Error(
          errorFromResponse(data, "Failed to load admins", adminsRes.status),
        );
      }
      setAdmins(data?.admins ?? []);
      if (pushRes.ok) {
        const push = await readResponseJson<{
          configured: boolean;
          production: boolean;
          tokenCount: number;
          hint: string;
          bundleId: string | null;
        }>(pushRes);
        if (push) setPushStatus(push);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePermission(
    list: AdminPermission[],
    permission: AdminPermission,
  ): AdminPermission[] {
    return list.includes(permission)
      ? list.filter((item) => item !== permission)
      : [...list, permission];
  }

  async function createAdmin() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          name: createForm.name || undefined,
          role: createForm.role,
          useCustomPermissions: createForm.useCustomPermissions,
          permissions: createForm.permissions,
        }),
      });
      const data = await readResponseJson<{ email?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(errorFromResponse(data, "Create failed", res.status));
      }
      setCreateForm(emptyForm);
      setMessage(`Created admin ${data?.email ?? createForm.email}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(admin: AdminRow) {
    setEditingId(admin.id);
    setEditForm({
      name: admin.name ?? "",
      role: admin.role,
      password: "",
      active: admin.active,
      useCustomPermissions: admin.permissions.length > 0,
      permissions:
        admin.permissions.length > 0
          ? (admin.permissions as AdminPermission[])
          : [...ROLE_DEFAULT_PERMISSIONS[admin.role]],
    });
    setMessage("");
    setError("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name,
          role: editForm.role,
          active: editForm.active,
          password: editForm.password || undefined,
          useCustomPermissions: editForm.useCustomPermissions,
          permissions: editForm.permissions,
        }),
      });
      const data = await readResponseJson<{ email?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(errorFromResponse(data, "Update failed", res.status));
      }
      setEditingId(null);
      setMessage(`Updated ${data?.email ?? "admin"}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(admin: AdminRow) {
    if (
      !window.confirm(
        `Delete admin ${admin.email}? They will lose access immediately.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/admins?id=${encodeURIComponent(admin.id)}`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        throw new Error(errorFromResponse(data, "Delete failed", res.status));
      }
      setMessage(`Deleted ${admin.email}`);
      if (editingId === admin.id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const roleOptions =
    currentRole === "OWNER"
      ? (["OWNER", "MANAGER", "STAFF"] as AdminRoleName[])
      : (["MANAGER", "STAFF"] as AdminRoleName[]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </div>
      ) : null}

      {pushStatus ? (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold text-foreground">Push notifications</h2>
          <p className="text-sm text-muted">{pushStatus.hint}</p>
          <p className="text-xs text-muted">
            Configured: {pushStatus.configured ? "yes" : "no"} · Gateway:{" "}
            {pushStatus.production ? "production" : "sandbox"} · Devices:{" "}
            {pushStatus.tokenCount}
            {pushStatus.bundleId ? ` · Bundle: ${pushStatus.bundleId}` : ""}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={pushBusy || !pushStatus.configured || pushStatus.tokenCount === 0}
            onClick={() => {
              void (async () => {
                setPushBusy(true);
                setError("");
                setMessage("");
                try {
                  const res = await fetch("/api/admin/push-status", { method: "POST" });
                  const data = await readResponseJson<{
                    hint?: string;
                    error?: string;
                    sent?: number;
                  }>(res);
                  if (!res.ok) {
                    throw new Error(
                      errorFromResponse(data, "Test push failed", res.status),
                    );
                  }
                  setMessage(data?.hint ?? `Sent ${data?.sent ?? 0} test push(es)`);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Test push failed");
                } finally {
                  setPushBusy(false);
                }
              })();
            }}
          >
            {pushBusy ? "Sending..." : "Send test push"}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pushBusy || pushStatus.tokenCount === 0}
            onClick={() => {
              void (async () => {
                if (
                  !window.confirm(
                    "Clear all saved push device tokens? Phones must Enable & sync again afterwards.",
                  )
                ) {
                  return;
                }
                setPushBusy(true);
                setError("");
                setMessage("");
                try {
                  const res = await fetch("/api/admin/push-status", {
                    method: "DELETE",
                  });
                  const data = await readResponseJson<{
                    hint?: string;
                    error?: string;
                  }>(res);
                  if (!res.ok) {
                    throw new Error(
                      errorFromResponse(data, "Clear failed", res.status),
                    );
                  }
                  setMessage(data?.hint ?? "Cleared device tokens");
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Clear failed");
                } finally {
                  setPushBusy(false);
                }
              })();
            }}
          >
            Clear device tokens
          </Button>
        </Card>
      ) : null}

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Add admin</h2>
          <p className="mt-1 text-sm text-muted">
            Create another login and assign a role or custom permissions.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
          <Input
            label="Temporary password"
            type="password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
          <Input
            label="Display name"
            value={createForm.name}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <Select
            label="Role"
            value={createForm.role}
            options={roleOptions.map((role) => ({
              value: role,
              label: ROLE_LABELS[role],
            }))}
            placeholder="Select role"
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                role: event.target.value as AdminRoleName,
                permissions: prev.useCustomPermissions
                  ? prev.permissions
                  : [...ROLE_DEFAULT_PERMISSIONS[event.target.value as AdminRoleName]],
              }))
            }
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={createForm.useCustomPermissions}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                useCustomPermissions: event.target.checked,
                permissions: event.target.checked
                  ? [...ROLE_DEFAULT_PERMISSIONS[prev.role]]
                  : [],
              }))
            }
          />
          Override with custom permissions
        </label>

        {createForm.useCustomPermissions ? (
          <PermissionChecklist
            selected={createForm.permissions}
            onToggle={(permission) =>
              setCreateForm((prev) => ({
                ...prev,
                permissions: togglePermission(prev.permissions, permission),
              }))
            }
          />
        ) : (
          <p className="text-sm text-muted">
            Default for {ROLE_LABELS[createForm.role]}:{" "}
            {ROLE_DEFAULT_PERMISSIONS[createForm.role]
              .map((permission) => PERMISSION_LABELS[permission])
              .join(", ")}
          </p>
        )}

        <Button type="button" onClick={() => void createAdmin()} disabled={saving}>
          {saving ? "Saving..." : "Create admin"}
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Team</h2>
          <p className="mt-1 text-sm text-muted">
            Change roles, toggle access, reset passwords, or remove accounts.
          </p>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-muted">Loading admins...</p>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((admin) => {
              const isSelf = admin.id === currentAdminId;
              const editing = editingId === admin.id;
              return (
                <li key={admin.id} className="space-y-4 px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {admin.name || admin.email}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted">{admin.email}</p>
                      <p className="mt-1 text-xs text-muted">
                        {ROLE_LABELS[admin.role]} ·{" "}
                        {admin.active ? "Active" : "Deactivated"} ·{" "}
                        {admin.effectivePermissions
                          .map((permission) => PERMISSION_LABELS[permission])
                          .join(", ") || "No permissions"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => startEdit(admin)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      {!isSelf ? (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => void removeAdmin(admin)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {editing ? (
                    <div className="space-y-3 rounded-xl border border-border bg-cream/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Display name"
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                        />
                        <Select
                          label="Role"
                          value={editForm.role}
                          options={roleOptions.map((role) => ({
                            value: role,
                            label: ROLE_LABELS[role],
                          }))}
                          placeholder="Select role"
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              role: event.target.value as AdminRoleName,
                              permissions: prev.useCustomPermissions
                                ? prev.permissions
                                : [
                                    ...ROLE_DEFAULT_PERMISSIONS[
                                      event.target.value as AdminRoleName
                                    ],
                                  ],
                            }))
                          }
                          disabled={
                            currentRole !== "OWNER" && admin.role === "OWNER"
                          }
                        />
                        <Input
                          label="New password (optional)"
                          type="password"
                          value={editForm.password}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              password: event.target.value,
                            }))
                          }
                        />
                        <label className="flex items-center gap-2 self-end pb-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.active}
                            disabled={isSelf}
                            onChange={(event) =>
                              setEditForm((prev) => ({
                                ...prev,
                                active: event.target.checked,
                              }))
                            }
                          />
                          Account active
                        </label>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.useCustomPermissions}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              useCustomPermissions: event.target.checked,
                              permissions: event.target.checked
                                ? [...ROLE_DEFAULT_PERMISSIONS[prev.role]]
                                : [],
                            }))
                          }
                        />
                        Override with custom permissions
                      </label>

                      {editForm.useCustomPermissions ? (
                        <PermissionChecklist
                          selected={editForm.permissions}
                          onToggle={(permission) =>
                            setEditForm((prev) => ({
                              ...prev,
                              permissions: togglePermission(
                                prev.permissions,
                                permission,
                              ),
                            }))
                          }
                        />
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={saving}
                        >
                          Save changes
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PermissionChecklist({
  selected,
  onToggle,
}: {
  selected: AdminPermission[];
  onToggle: (permission: AdminPermission) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ADMIN_PERMISSIONS.map((permission) => (
        <label
          key={permission}
          className="flex items-start gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={selected.includes(permission)}
            onChange={() => onToggle(permission)}
          />
          <span>
            <span className="font-medium text-foreground">
              {PERMISSION_LABELS[permission]}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{permission}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
