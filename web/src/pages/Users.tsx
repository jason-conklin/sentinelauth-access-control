import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import RoleChips from "../components/RoleChips";
import RoleMultiSelect from "../components/RoleMultiSelect";
import ConfirmModal from "../components/ConfirmModal";

interface User {
  id: number;
  email: string;
  roles?: string[];
  is_active: boolean;
}

interface UsersPageProps {
  currentUser?: {
    id?: number;
    email?: string;
    roles?: string[];
  } | null;
}

type ToastState = { type: "success" | "error"; message: string } | null;

const ensureRoles = (roles?: string[]) => (Array.isArray(roles) ? roles : []);
const normalizeRoles = (roles: string[]) =>
  Array.from(new Set([...ensureRoles(roles).filter(Boolean), "user"]));
const toMessage = (value: unknown): string => {
  if (value == null) return "Unknown error";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => toMessage(item)).filter(Boolean).join("; ") || "Unknown error";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.detail) return toMessage(record.detail);
    if (record.message) return toMessage(record.message);
    if (record.msg) return toMessage(record.msg);
    return JSON.stringify(value);
  }
  return "Unknown error";
};

const UsersPage = ({ currentUser }: UsersPageProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; roles: string[] } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmDemote, setConfirmDemote] = useState<{ user: User; roles: string[] } | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await apiClient.get("/users");
      const payload: User[] = Array.isArray(res.data?.users) ? res.data.users : [];
      setUsers(
        payload.map((user) => ({
          ...user,
          roles: ensureRoles(user.roles),
        }))
      );
      setError(null);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ?? err?.response?.data ?? err?.message ?? "Failed to load users";
      setError(toMessage(message));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const adminCount = useMemo(() => {
    return users.reduce((count, user) => {
      const roles = ensureRoles(user.roles);
      return roles.includes("admin") ? count + 1 : count;
    }, 0);
  }, [users]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const startEditing = (user: User) => {
    setEditing({ id: user.id, roles: [...ensureRoles(user.roles)] });
  };

  const cancelEditing = () => setEditing(null);

  const setEditingRoles = (userId: number, roles: string[]) => {
    setEditing((prev) => {
      if (!prev || prev.id !== userId) return prev;
      return { ...prev, roles: normalizeRoles(roles) };
    });
  };

  const handleSave = async (user: User, rolesInput?: string[], forceDemote = false) => {
    const currentRoles = ensureRoles(user.roles);
    const desiredRoles = normalizeRoles(
      rolesInput ?? (editing?.id === user.id ? editing.roles : currentRoles)
    );

    const originalIsAdmin = currentRoles.includes("admin");
    const newIsAdmin = desiredRoles.includes("admin");
    const projectedAdminCount =
      adminCount - (originalIsAdmin ? 1 : 0) + (newIsAdmin ? 1 : 0);

    if (!newIsAdmin && originalIsAdmin && adminCount <= 1) {
      setToast({ type: "error", message: "You must keep at least one administrator." });
      return;
    }

    if (projectedAdminCount === 0) {
      setToast({ type: "error", message: "You must keep at least one administrator." });
      return;
    }

    const selfId = currentUser?.id;
    const removingOwnAdmin =
      selfId != null && selfId === user.id && originalIsAdmin && !newIsAdmin;

    if (removingOwnAdmin && !forceDemote) {
      setConfirmDemote({ user, roles: desiredRoles });
      return;
    }

    setSavingId(user.id);
    const additions = desiredRoles.filter(
      (role) => role !== "user" && !currentRoles.includes(role)
    );
    const removals = currentRoles.filter(
      (role) => role !== "user" && !desiredRoles.includes(role)
    );

    try {
      for (const role of additions) {
        await apiClient.post(`/users/${user.id}/roles`, { role, action: "add" });
      }
      for (const role of removals) {
        await apiClient.post(`/users/${user.id}/roles`, { role, action: "remove" });
      }
      await loadUsers(true);
      const message =
        additions.length === 0 && removals.length === 0
          ? "No role changes applied."
          : `Roles updated for ${user.email}.`;
      setToast({ type: "success", message });
      setEditing(null);
    } catch (err: any) {
      if (err?.response) {
        const status = err.response.status;
        if (status === 401 || status === 403) {
          setToast({ type: "error", message: "Not authorized to update roles." });
        } else if (status === 429) {
          setToast({ type: "error", message: "Too many requests, please try again shortly." });
        } else if (status >= 500) {
          setToast({ type: "error", message: "Server error, please try again." });
        } else {
          const detail = err.response?.data?.detail ?? err.response?.data;
          setToast({
            type: "error",
            message: toMessage(detail ?? "Failed to update roles."),
          });
        }
      } else {
        console.error("save roles error", err);
        setToast({ type: "error", message: "Network error while saving roles." });
      }
    } finally {
      setSavingId(null);
    }
  };

  const confirmDemotion = () => {
    if (!confirmDemote) return;
    const { user, roles } = confirmDemote;
    setConfirmDemote(null);
    void handleSave(user, roles, true);
  };

  const isEditing = (userId: number) => editing?.id === userId;
  const isSaving = (userId: number) => savingId === userId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-ink">Users</h2>
        <button className="btn-secondary" onClick={() => void loadUsers()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {toast && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            toast.type === "success"
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-red-300 bg-red-100 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="overflow-visible rounded-lg border border-border-gold/60 bg-white shadow-soft">
        <table className="min-w-full divide-y divide-border-gold/40">
          <thead className="bg-brand-200/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {users.map((user) => {
              const editingRow = isEditing(user.id);
              const displayRoles = editingRow ? ensureRoles(editing?.roles) : ensureRoles(user.roles);
              return (
                <tr
                  key={user.id}
                  className="border-b border-border-gold/40 last:border-b-0 hover:bg-brand-200/30"
                >
                  <td className="px-4 py-3 text-text-ink">{user.email}</td>
                  <td className="px-4 py-3 text-text-ink">
                    <RoleChips roles={displayRoles} />
                    {editingRow && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <RoleMultiSelect
                          value={displayRoles}
                          onChange={(roles) => setEditingRoles(user.id, roles)}
                          disabled={isSaving(user.id)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-ink">{user.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    {editingRow ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave(user, editing?.roles)}
                          disabled={isSaving(user.id)}
                          className="inline-flex items-center rounded-md border border-border-gold bg-brand-300 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving(user.id) ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={isSaving(user.id)}
                          className="inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-xs font-medium text-text-ink transition hover:bg-brand-200/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(user)}
                        className="inline-flex items-center rounded-md border border-border-gold bg-white px-3 py-1.5 text-xs font-medium text-text-ink transition hover:bg-brand-200/60"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-4 text-sm text-text-ink/70">No users found.</p>}
      </div>
      <ConfirmModal
        open={Boolean(confirmDemote)}
        title="Confirm admin removal"
        message="You are removing your own admin access. This may limit your ability to manage other users."
        confirmLabel="Remove access"
        cancelLabel="Keep admin"
        onConfirm={confirmDemotion}
        onCancel={() => setConfirmDemote(null)}
      />
    </div>
  );
};

export default UsersPage;
