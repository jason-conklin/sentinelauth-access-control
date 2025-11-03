import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    users: 0,
    sessions: 0,
    audits24h: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, sessionsRes, auditRes] = await Promise.all([
          apiClient.get("/users"),
          apiClient.get("/sessions"),
          apiClient.get("/audit", { params: { hours: 24 } }),
        ]);
        setMetrics({
          users: usersRes.data.users.length,
          sessions: sessionsRes.data.sessions.filter((s: any) => s.active).length,
          audits24h: auditRes.data.events.length,
        });
      } catch (error) {
        console.error("Failed to load dashboard metrics", error);
      }
    };
    load();
  }, []);

  const cards = [
    { label: "Total Users", value: metrics.users },
    { label: "Active Sessions", value: metrics.sessions },
    { label: "Audit Events (24h)", value: metrics.audits24h },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-ink">Security Overview</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border-gold/60 bg-white p-4 shadow-soft"
          >
            <p className="text-xs uppercase text-text-ink/70">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-text-ink">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
