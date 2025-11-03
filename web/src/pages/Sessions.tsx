import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import Table, { TableColumn } from "../components/Table";

interface Session {
  id: number;
  user_id: number;
  ip: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  active: boolean;
}

const SessionsPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const res = await apiClient.get("/sessions");
      setSessions(res.data.sessions);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to load sessions");
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const revoke = async (sessionId: number) => {
    try {
      await apiClient.post(`/sessions/${sessionId}/revoke`);
      await loadSessions();
    } catch (err) {
      setError("Failed to revoke session");
    }
  };

  const tableData = sessions.map((session) => ({
    id: session.id,
    user_id: session.user_id,
    ip: session.ip ?? "\u2014",
    device_fingerprint: session.device_fingerprint ?? "\u2014",
    user_agent: session.user_agent ?? "\u2014",
    active: session.active,
  }));

  const columns: TableColumn<typeof tableData[number]>[] = [
    { key: "id", label: "ID", sortable: true },
    { key: "user_id", label: "User", sortable: true },
    { key: "ip", label: "IP", sortable: true },
    { key: "device_fingerprint", label: "Device", sortable: true },
    { key: "user_agent", label: "User Agent", sortable: true },
    {
      key: "active",
      label: "Active",
      sortable: true,
      comparator: (a, b) => (a.active === b.active ? 0 : a.active ? 1 : -1),
      render: (row) => (row.active ? "Yes" : "No"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-ink">Sessions</h2>
        <button className="btn-secondary" onClick={loadSessions}>
          Refresh
        </button>
      </div>
      <p className="text-sm text-text-ink/70">
        Observe active service sessions, investigate device fingerprints, and revoke risky connections.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table keyField="id" columns={columns} data={tableData} />
      <div className="flex flex-wrap gap-2">
        {sessions
          .filter((session) => session.active)
          .map((session) => (
            <button key={session.id} className="btn-muted" onClick={() => revoke(session.id)}>
              Revoke #{session.id}
            </button>
          ))}
      </div>
    </div>
  );
};

export default SessionsPage;
