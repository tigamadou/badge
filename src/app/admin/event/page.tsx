"use client";

import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/EventForm";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

export default function EventPage() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then(setEvent);
  }, []);

  async function handleSubmit(data: EventData) {
    await fetch("/api/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!event) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuration de l&apos;événement</h1>
      {saved && (
        <p className="text-sm text-green-600 mb-4">Modifications enregistrées.</p>
      )}
      <div className="bg-white rounded-lg shadow p-6">
        <EventForm initialData={event} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
