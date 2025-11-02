import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import Table from "../components/Table";

interface User {
  id: number;
  email: string;
  roles: string[];
  is_active: boolean;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/users");
      setUsers(res.data.users);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleAdmin = async (user: User) => {
    const isAdmin = user.roles.includes("admin");
    try {
      await apiClient.post(`/users/${user.id}/roles`, {
        role: "admin",
        action: isAdmin ? "remove" : "add",
      });
      await loadUsers();
    } catch (err) {
      setError("Failed to update role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Users</h2>
        <button className="btn-secondary" onClick={loadUsers} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Table
        keyField="id"
        columns={[
          { key: "email", label: "Email" },
          { key: "roles", label: "Roles" },
          { key: "is_active", label: "Active" },
        ]}
        data={users.map((user) => ({
          ...user,
          roles: user.roles.join(", "),
          is_active: user.is_active ? "Yes" : "No",
        }))}
      />
      <div className="space-y-2">
        {users.map((user) => (
          <button
            key={user.id}
            className="btn-muted"
            onClick={() => toggleAdmin(user)}
            disabled={loading}
          >
            {user.roles.includes("admin") ? `Remove admin → ${user.email}` : `Grant admin → ${user.email}`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default UsersPage;
