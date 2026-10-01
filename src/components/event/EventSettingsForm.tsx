"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Switch } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/Feedback";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { linesToInstructions } from "@/lib/security-instructions";

type Initial = {
  event: {
    id: string;
    title: string;
    location: string;
    date: string;
    endDate: string | null;
    description: string | null;
    slug: string;
    logo: string | null;
    securityInstructions: string[];
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
  const [endDate, setEndDate] = useState(initial.event.endDate?.slice(0, 10) ?? "");
  const [description, setDescription] = useState(initial.event.description ?? "");
  const [logo, setLogo] = useState<string | null>(initial.event.logo);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(initial.event.registrationOpen);
  // Brouillon brut : re-deriver la zone de texte depuis la liste nettoyee
  // effacerait la ligne vide qu'on vient d'ouvrir avec Entree.
  const [instructionsDraft, setInstructionsDraft] = useState(
    initial.event.securityInstructions.join("\n"),
  );
  const [contactEmail, setContactEmail] = useState(initial.settings.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial.settings.contactPhone ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function uploadLogo(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploadingLogo(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/org/${orgId}/upload`, { method: "POST", body: fd });
    setUploadingLogo(false);
    if (!res.ok) {
      setMsg("Échec de l'envoi du logo.");
      return;
    }
    const { storageKey } = await res.json();
    setLogo(storageKey);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        location,
        date,
        endDate: endDate || null,
        description: description || null,
        logo,
        securityInstructions: linesToInstructions(instructionsDraft),
        registrationOpen,
      }),
    });
    if (res.ok) {
      setMsg("Événement mis à jour.");
    } else {
      const data = await res.json().catch(() => null);
      if (data?.issues?.[0]?.message === "endDate < date") {
        setMsg("La date de fin doit être postérieure ou égale à la date de l'événement.");
      } else if (data?.issues?.[0]?.path?.[0] === "securityInstructions") {
        setMsg("Consignes : 30 au plus, 500 caractères chacune.");
      } else {
        setMsg("Échec de la mise à jour.");
      }
    }
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input
                label="Date de fin (optionnelle)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="event-description" className="block text-sm font-medium text-slate-700">
                Description (optionnelle)
              </label>
              <textarea
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Logo</span>
              {logo ? (
                <FileBox
                  icon="file"
                  thumbUrl={`/api/files/${logo}`}
                  title="Logo de l'événement"
                  subtitle={logo}
                  action={
                    <Button type="button" variant="secondary" onClick={() => setLogo(null)}>
                      Retirer
                    </Button>
                  }
                />
              ) : (
                <Dropzone
                  onFiles={uploadLogo}
                  accept="image/jpeg,image/png,image/webp"
                  title={uploadingLogo ? "Envoi…" : "Déposer un logo ou cliquer"}
                  subtitle="JPEG, PNG ou WebP — 5 Mo max"
                />
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="event-security-instructions" className="block text-sm font-medium text-slate-700">
                Consignes de sécurité (optionnelles)
              </label>
              <textarea
                id="event-security-instructions"
                value={instructionsDraft}
                onChange={(e) => setInstructionsDraft(e.target.value)}
                rows={5}
                placeholder="Une consigne par ligne"
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-slate-400">
                Imprimées sur les badges dont le template affiche les consignes. Une par ligne,
                30 au plus, 500 caractères chacune.
              </p>
            </div>
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
