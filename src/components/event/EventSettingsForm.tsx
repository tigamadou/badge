"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Switch } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/Feedback";

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
    const res = await fetch(`/api/org/${orgId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, location, date, logo, registrationOpen }),
    });
    setMsg(res.ok ? "Événement mis à jour." : "Échec de la mise à jour.");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/settings`, {
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
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Paramètres de l&apos;événement</h1>
        <p className="mt-0.5 text-sm text-slate-400">Informations, inscriptions et contact</p>
      </div>
      {msg && <Alert tone={msg.includes("Échec") ? "err" : "success"}>{msg}</Alert>}

      <Card>
        <CardHead title="Informations" />
        <CardBody>
          <form onSubmit={saveEvent} className="space-y-4">
            <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input
              label="Logo (chemin uploads/…)"
              value={logo ?? ""}
              onChange={(e) => setLogo(e.target.value || null)}
              placeholder="uploads/.../logo.png"
            />
            <Switch checked={registrationOpen} onChange={setRegistrationOpen} label="Inscriptions ouvertes" />
            <p className="text-xs text-slate-400">
              Slug : <code className="font-mono text-slate-600">{initial.event.slug}</code> (modifiable par le staff
              uniquement)
            </p>
            <div className="flex justify-end">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Contact (surcharges)" subtitle="Laisser vide pour hériter du niveau organisation." />
        <CardBody>
          <form onSubmit={saveSettings} className="space-y-4">
            <Input
              label="E-mail de contact"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={`Cascade : ${initial.resolved.contactEmail || "—"}`}
            />
            <Input
              label="Téléphone de contact"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={`Cascade : ${initial.resolved.contactPhone || "—"}`}
            />
            <p className="text-xs text-slate-400">
              Les paramètres SMTP sont gérés au niveau plateforme uniquement (décision 2026-05-31).
            </p>
            <div className="flex justify-end">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
