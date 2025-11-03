import { useEffect, useMemo, useState } from "react";
import Table, { TableColumn } from "../components/Table";
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

const PLACEHOLDER = "\u2014";

const formatDate = (value?: string) => {
  if (!value) return PLACEHOLDER;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
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

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  const mappedSessions = useMemo(
    () =>
      sessions.map((session, idx) => ({
        id: session.id ?? `session-${idx}`,
        ip: session.ip ?? PLACEHOLDER,
        device_fingerprint: session.device_fingerprint ?? PLACEHOLDER,
        user_agent: session.user_agent ?? PLACEHOLDER,
        created: formatDate(session.created_at),
        createdRaw: session.created_at ?? "",
        last_seen: formatDate(session.last_seen_at),
        lastSeenRaw: session.last_seen_at ?? "",
        active: Boolean(session.active),
      })),
    [sessions]
  );

  const columns: TableColumn<(typeof mappedSessions)[number]>[] = [
    { key: "ip", label: "IP", sortable: true },
    { key: "device_fingerprint", label: "Device", sortable: true },
    { key: "user_agent", label: "User Agent", sortable: true },
    {
      key: "created",
      label: "Created",
      sortable: true,
      comparator: (a, b) => Date.parse(a.createdRaw) - Date.parse(b.createdRaw),
    },
    {
      key: "last_seen",
      label: "Last Seen",
      sortable: true,
      comparator: (a, b) => Date.parse(a.lastSeenRaw) - Date.parse(b.lastSeenRaw),
    },
    {
      key: "active",
      label: "Active",
      sortable: true,
      comparator: (a, b) => (a.active === b.active ? 0 : a.active ? 1 : -1),
      render: (row) => (row.active ? "Yes" : "No"),
    },
  ];

  if (loading) {
    return <p className="text-sm text-text-ink/70">Loading sessions…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

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
      <Table keyField="id" columns={columns} data={mappedSessions} />
      <p className="text-xs text-text-ink/60">
        To revoke access for a device, sign out from that device or contact an administrator.
      </p>
    </div>
  );
};

export default MySessions;
