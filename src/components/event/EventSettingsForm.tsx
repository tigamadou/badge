"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Initial = {
  event: {
    id: string;
    title: string;
    location: string;
    date: string;
    slug: string;
    logo: string | null;
    registrationOpen: boolean;
  };
  settings: { contactEmail: string | null; contactPhone: string | null };
  resolved: { contactEmail: string; contactPhone: string };
};

export function EventSettingsForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Initial;
}) {
  const [title, setTitle] = useState(initial.event.title);
  const [location, setLocation] = useState(initial.event.location);
  const [date, setDate] = useState(initial.event.date.slice(0, 10));
  const [logo, setLogo] = useState<string | null>(initial.event.logo);
  const [registrationOpen, setRegistrationOpen] = useState(initial.event.registrationOpen);
  const [contactEmail, setContactEmail] = useState(initial.settings.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial.settings.contactPhone ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, location, date, logo, registrationOpen }),
    });
    setMsg(res.ok ? "Événement mis à jour." : "Échec de la mise à jour.");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      }),
    });
    setMsg(res.ok ? "Paramètres enregistrés." : "Échec.");
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres de l&apos;événement</h1>
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-4 py-2 text-sm">{msg}</div>}

      <form onSubmit={saveEvent} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Informations</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input
          value={logo ?? ""}
          onChange={(e) => setLogo(e.target.value || null)}
          placeholder="Chemin du logo (uploads/.../logo.png)"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={registrationOpen}
            onChange={(e) => setRegistrationOpen(e.target.checked)}
          />
          Inscriptions ouvertes
        </label>
        <div className="text-xs text-gray-500">
          Slug : <code>{initial.event.slug}</code> (modifiable par le staff uniquement)
        </div>
        <Button type="submit">Enregistrer</Button>
      </form>

      <form onSubmit={saveSettings} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Contact (overrides)</h2>
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={`Email de contact (cascade : ${initial.resolved.contactEmail || "—"})`}
        />
        <Input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder={`Téléphone de contact (cascade : ${initial.resolved.contactPhone || "—"})`}
        />
        <p className="text-xs text-gray-500">
          Laisser vide pour hériter du niveau organisation. Les paramètres SMTP sont gérés au niveau plateforme uniquement (décision 2026-05-31).
        </p>
        <Button type="submit">Enregistrer</Button>
      </form>
    </div>
  );
}
