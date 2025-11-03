import { useEffect, useState } from "react";
import Table from "../components/Table";
import { apiClient } from "../api/client";

interface SessionRecord {
  id?: string | number;
  created_at?: string;
  last_seen_at?: string;
  ip?: string | null;
  user_agent?: string | null;
  device_fingerprint?: string | null;
  active?: boolean;
}

const formatDate = (value?: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const MySessions = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get("/auth/me/sessions");
        if (!cancelled) {
          setSessions(response.data.sessions ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail ?? "Failed to load sessions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-text-ink/70">Loading sessions…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const mappedSessions = sessions.map((session, idx) => ({
    id: session.id ?? `session-${idx}`,
    ip: session.ip ?? "—",
    device_fingerprint: session.device_fingerprint ?? "—",
    user_agent: session.user_agent ?? "—",
    created: formatDate(session.created_at),
    last_seen: formatDate(session.last_seen_at),
    active: session.active ? "Yes" : "No",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-ink">My Sessions</h2>
          <p className="text-sm text-text-ink/70">
            Review the devices currently authenticated with your account.
          </p>
        </div>
      </div>
      <Table
        keyField="id"
        columns={[
          { key: "ip", label: "IP" },
          { key: "device_fingerprint", label: "Device" },
          { key: "user_agent", label: "User Agent" },
          { key: "created", label: "Created" },
          { key: "last_seen", label: "Last Seen" },
          { key: "active", label: "Active" },
        ]}
        data={mappedSessions}
      />
      <p className="text-xs text-text-ink/60">
        To revoke access for a device, sign out from that device or contact an administrator.
      </p>
    </div>
  );
};

export default MySessions;
