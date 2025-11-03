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
      <section className="rounded-lg border border-border-gold/60 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-text-ink">SentinelAuth at a Glance</h2>
        <p className="mt-2 text-sm text-text-ink/70">
          SentinelAuth is a role-based security platform that unifies strong authentication, session
          intelligence, and audit visibility. Use it to onboard users, enforce principle-of-least
          privilege, and surface suspicious activity before it becomes an incident.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-text-ink/80">
          <li>Centralize user identities and assign granular admin, moderator, or user roles.</li>
          <li>Monitor live sessions, device fingerprints, and login anomalies in real time.</li>
          <li>Streamline compliance with durable audit trails and automated rotation of refresh tokens.</li>
        </ul>
      </section>
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
