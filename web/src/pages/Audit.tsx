import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import Table, { TableColumn } from "../components/Table";

interface AuditEvent {
  id: number;
  event_type: string;
  user_id: number | null;
  ts: string;
  ip: string | null;
}

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
};

const compareNullableNumber = (a: number | null, b: number | null) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a - b;
};

const AuditPage = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [hours, setHours] = useState(24);
  const [eventType, setEventType] = useState("");

  const loadEvents = async (params?: Record<string, any>) => {
    const res = await apiClient.get("/audit", { params });
    setEvents(res.data.events);
  };

  useEffect(() => {
    loadEvents({ hours: 24 });
  }, []);

  const handleFilter = (event: FormEvent) => {
    event.preventDefault();
    const params: Record<string, any> = {};
    if (hours) params.hours = hours;
    if (eventType) params.event_type = eventType;
    loadEvents(params);
  };

  const tableData = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        ip: event.ip ?? "—",
      })),
    [events]
  );

  const columns: TableColumn<typeof tableData[number]>[] = [
    { key: "id", label: "ID", sortable: true },
    { key: "event_type", label: "Event", sortable: true },
    {
      key: "user_id",
      label: "User",
      sortable: true,
      comparator: (a, b) => compareNullableNumber(a.user_id, b.user_id),
      render: (row) => (row.user_id == null ? "—" : row.user_id),
    },
    { key: "ip", label: "IP", sortable: true },
    {
      key: "ts",
      label: "Timestamp",
      sortable: true,
      comparator: (a, b) => Date.parse(a.ts) - Date.parse(b.ts),
      render: (row) => formatDateTime(row.ts),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-ink">Audit Log</h2>
      </div>
      <form className="flex flex-wrap items-end gap-4" onSubmit={handleFilter}>
        <label className="flex flex-col text-sm text-text-ink/80">
          <span className="text-text-ink/70">Hours</span>
          <input type="number" className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))} min={1} />
        </label>
        <label className="flex flex-col text-sm text-text-ink/80">
          <span className="text-text-ink/70">Event Type</span>
          <input type="text" className="input" value={eventType} onChange={(e) => setEventType(e.target.value)} />
        </label>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </form>
      <Table keyField="id" columns={columns} data={tableData} />
    </div>
  );
};

export default AuditPage;
