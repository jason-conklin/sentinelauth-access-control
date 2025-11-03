import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import Table from "../components/Table";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-ink">Sessions</h2>
        <button className="btn-secondary" onClick={loadSessions}>
          Refresh
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table
        keyField="id"
        columns={[
          { key: "id", label: "ID" },
          { key: "user_id", label: "User" },
          { key: "ip", label: "IP" },
          { key: "device_fingerprint", label: "Device" },
          { key: "active", label: "Active" },
        ]}
        data={sessions.map((session) => ({
          ...session,
          active: session.active ? "Yes" : "No",
        }))}
      />
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
