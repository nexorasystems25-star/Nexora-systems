"use client";
import { useState, useEffect } from "react";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  max_attendees: number;
}

interface EventsResponse {
  events: Event[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default function EventsPage() {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/events?upcoming=true&limit=20");
        if (!res.ok) throw new Error("Failed to fetch events");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const events = data?.events || [];
  const totalEvents = data?.pagination.total ?? 0;

  const getEventStatus = (startDate: string) => {
    const now = new Date();
    const eventDate = new Date(startDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    if (eventDay.getTime() === today.getTime()) return "Today";
    if (eventDay > today) return "Upcoming";
    return "Past";
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
          <div>
            <h1 style={{ marginBottom: "var(--space-xs)" }}>Events</h1>
            <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
          <div>
            <h1 style={{ marginBottom: "var(--space-xs)" }}>Events</h1>
          </div>
        </div>
        <div className="card card-padding" style={{ color: "var(--error)" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Page heading */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
        <div>
          <h1 style={{ marginBottom: "var(--space-xs)" }}>Events</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>
            Schedule services, conferences, and activities. Track attendance and manage volunteers.
          </p>
        </div>
        <button className="btn btn-primary">+ Create Event</button>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Total Events</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, marginTop: "var(--space-xs)" }}>{totalEvents}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>This Month</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, marginTop: "var(--space-xs)" }}>
            {events.filter((e) => {
              const d = new Date(e.start_date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Upcoming</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, marginTop: "var(--space-xs)" }}>
            {events.filter((e) => getEventStatus(e.start_date) !== "Past").length}
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Total Capacity</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, marginTop: "var(--space-xs)" }}>
            {events.reduce((sum, e) => sum + (e.max_attendees || 0), 0)}
          </p>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="section-header">
        <h2 className="section-title">Upcoming Events</h2>
      </div>
      {events.length === 0 ? (
        <div className="card card-padding" style={{ textAlign: "center", color: "var(--muted)" }}>
          No upcoming events
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {events.map((event) => {
            const status = getEventStatus(event.start_date);
            return (
              <div key={event.id} className="card" style={{ padding: "var(--space-lg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-xs)" }}>{event.title}</h3>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
                      {formatDateTime(event.start_date)} at {formatTime(event.start_date)}
                    </p>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>{event.location || "No location set"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${status === "Today" ? "badge-warning" : "badge-primary"}`}>
                      {status}
                    </span>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: "var(--space-sm)" }}>
                      {event.max_attendees ? `${event.max_attendees} capacity` : "No limit set"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
