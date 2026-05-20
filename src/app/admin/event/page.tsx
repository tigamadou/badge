"use client";

import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/EventForm";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
  registrationOpen: boolean;
}

export default function EventPage() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [saved, setSaved] = useState(false);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then(setEvent);
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        if (session?.user?.role) setUserRole(session.user.role);
      });
  }, []);

  async function handleSubmit(data: { title: string; location: string; date: string; logo: string | null; registrationOpen?: boolean }) {
    const res = await fetch("/api/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setEvent(updated);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!event) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Configuration de l&apos;événement</h1>
      {saved && (
        <p className="text-sm text-emerald-600 mb-4">Modifications enregistrées.</p>
      )}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <EventForm
          initialData={event}
          onSubmit={handleSubmit}
          showRegistrationToggle={userRole === "SUPER_ADMIN"}
        />
      </div>
    </div>
  );
}
