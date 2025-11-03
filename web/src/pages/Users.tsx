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
type SortKey = "email" | "roles" | "active";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const ROLE_WEIGHT: Record<string, number> = {
  admin: 3,
  moderator: 2,
  user: 1,
};

const ensureRoles = (roles?: string[]) => (Array.isArray(roles) ? roles : []);

const normalizeRoles = (roles: string[]) =>
  Array.from(new Set([...ensureRoles(roles).filter(Boolean), "user"]));

const sortRolesForDisplay = (roles: string[]) =>
  [...roles].sort((a, b) => {
    const weightDiff = (ROLE_WEIGHT[b] ?? 0) - (ROLE_WEIGHT[a] ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return a.localeCompare(b);
  });

const highestRoleWeight = (user: User) => {
  const userRoles = ensureRoles(user.roles);
  if (userRoles.length === 0) return 0;
  return Math.max(...userRoles.map((role) => ROLE_WEIGHT[role] ?? 0));
};

const compareUsersByRoles = (a: User, b: User) => {
  const diff = highestRoleWeight(a) - highestRoleWeight(b);
  if (diff !== 0) return diff;
  return a.email.localeCompare(b.email);
};

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
  const [sortState, setSortState] = useState<SortState | null>(null);

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
      setError(
        toMessage(
          err?.response?.data?.detail ?? err?.response?.data ?? err?.message ?? "Failed to load users"
        )
      );
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
    setEditing({ id: user.id, roles: normalizeRoles(ensureRoles(user.roles)) });
  };

  const cancelEditing = () => setEditing(null);

  const setEditingRoles = (userId: number, roles: string[]) => {
    setEditing((prev) => {
      if (!prev || prev.id !== userId) return prev;
      return { ...prev, roles: normalizeRoles(roles) };
    });
  };

  const handleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev?.key === key) {
        const nextDirection = prev.direction === "asc" ? "desc" : "asc";
        return { key, direction: nextDirection };
      }
      return { key, direction: "asc" };
    });
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortState?.key !== key) {
      return <span className="ml-1 text-text-ink/40">{"\u2195"}</span>;
    }
    return (
      <span className="ml-1 text-text-ink/80">
        {sortState.direction === "asc" ? "\u2191" : "\u2193"}
      </span>
    );
  };

  const sortedUsers = useMemo(() => {
    if (!sortState) return users;
    const items = [...users];
    const comparatorMap: Record<SortKey, (a: User, b: User) => number> = {
      email: (a, b) => a.email.localeCompare(b.email),
      roles: compareUsersByRoles,
      active: (a, b) => (a.is_active === b.is_active ? 0 : a.is_active ? 1 : -1),
    };
    const comparator = comparatorMap[sortState.key];
    items.sort((a, b) => {
      const result = comparator(a, b);
      return sortState.direction === "asc" ? result : -result;
    });
    return items;
  }, [users, sortState]);

  const handleSave = async (user: User, rolesInput?: string[], forceDemote = false) => {
    const currentRoles = ensureRoles(user.roles);
    const baseRoles = rolesInput ?? (editing?.id === user.id ? editing.roles : currentRoles);
    const desiredRoles = normalizeRoles(baseRoles);

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

    const additions = desiredRoles.filter(
      (role) => role !== "user" && !currentRoles.includes(role)
    );
    const removals = currentRoles.filter(
      (role) => role !== "user" && !desiredRoles.includes(role)
    );

    setSavingId(user.id);
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
          setToast({ type: "error", message: toMessage(detail ?? "Failed to update roles.") });
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
                <button
                  type="button"
                  onClick={() => handleSort("email")}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-text-ink transition hover:text-text-ink/70"
                >
                  Email
                  {renderSortIndicator("email")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                <button
                  type="button"
                  onClick={() => handleSort("roles")}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-text-ink transition hover:text-text-ink/70"
                >
                  Roles
                  {renderSortIndicator("roles")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                <button
                  type="button"
                  onClick={() => handleSort("active")}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-text-ink transition hover:text-text-ink/70"
                >
                  Active
                  {renderSortIndicator("active")}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-text-ink">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sortedUsers.map((user) => {
              const editingRow = editing?.id === user.id;
              const rolesForRow = editingRow
                ? ensureRoles(editing?.roles)
                : ensureRoles(user.roles);
              const displayRoles = sortRolesForDisplay(rolesForRow);

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
                          value={rolesForRow}
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
        {sortedUsers.length === 0 && (
          <p className="p-4 text-sm text-text-ink/70">No users found.</p>
        )}
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
