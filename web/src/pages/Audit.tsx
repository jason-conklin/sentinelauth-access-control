import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import Table from "../components/Table";

interface AuditEvent {
  id: number;
  event_type: string;
  user_id: number | null;
  ts: string;
  ip: string | null;
}

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit Log</h2>
      </div>
      <form className="flex flex-wrap items-end gap-4" onSubmit={handleFilter}>
        <label className="flex flex-col text-sm">
          <span className="text-slate-400">Hours</span>
          <input type="number" className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))} min={1} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-400">Event Type</span>
          <input type="text" className="input" value={eventType} onChange={(e) => setEventType(e.target.value)} />
        </label>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </form>
      <Table
        keyField="id"
        columns={[
          { key: "id", label: "ID" },
          { key: "event_type", label: "Event" },
          { key: "user_id", label: "User" },
          { key: "ip", label: "IP" },
          { key: "ts", label: "Timestamp" },
        ]}
        data={events}
      />
    </div>
  );
};

export default AuditPage;
