"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Switch } from "@/components/ui/FormControls";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { linesToInstructions } from "@/lib/security-instructions";
import { BadgeOptionsFields, type BadgeOption } from "@/components/event/BadgeOptionsFields";
import { mergeTemplateOptions, normalizeEditedOptions, type OptionValue } from "@/lib/badge-templates/template-options";

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
    banner: string | null;
    securityInstructions: string[];
    registrationOpen: boolean;
  };
  settings: { contactEmail: string | null; contactPhone: string | null };
  resolved: { contactEmail: string; contactPhone: string };
  options: BadgeOption[];
  optionValues: Record<string, OptionValue | null>;
  storedOptions: Record<string, unknown>;
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
  const [banner, setBanner] = useState<string | null>(initial.event.banner);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [optionValues, setOptionValues] = useState(initial.optionValues);
  const [registrationOpen, setRegistrationOpen] = useState(initial.event.registrationOpen);
  // Brouillon brut : re-deriver la zone de texte depuis la liste nettoyee
  // effacerait la ligne vide qu'on vient d'ouvrir avec Entree.
  const [instructionsDraft, setInstructionsDraft] = useState(
    initial.event.securityInstructions.join("\n"),
  );
  const [contactEmail, setContactEmail] = useState(initial.settings.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial.settings.contactPhone ?? "");
  const [fieldErrors, setFieldErrors] = useState<{
    endDate?: string;
    securityInstructions?: string;
    templateOptions?: string;
  }>({});

  // Motif F : l'indicateur « Envoi… » sert de loader, la FileBox affiche le succès ; seule l'erreur donne un toast.
  async function upload(
    files: FileList,
    setUploading: (v: boolean) => void,
    setter: (key: string) => void,
    fallback: string,
  ) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/org/${orgId}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw res;
      const { storageKey } = await res.json();
      setter(storageKey);
    } catch (err) {
      await toastApiError(err, fallback);
    } finally {
      setUploading(false);
    }
  }

  const uploadLogo = (files: FileList) =>
    upload(files, setUploadingLogo, setLogo, "Échec de l'envoi du logo.");
  const uploadBanner = (files: FileList) =>
    upload(files, setUploadingBanner, setBanner, "Échec de l'envoi de la bannière.");

  async function uploadOptionImage(file: File): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/org/${orgId}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw res;
      const { storageKey } = await res.json();
      return storageKey;
    } catch (err) {
      await toastApiError(err, "Échec de l'envoi de l'image.");
      return null;
    }
  }

  // Motif C : endDate, consignes et options sont rattachés à leur champ ; le reste lève (toast).
  const saveEvent = useAsyncAction(
    async (): Promise<{ fieldErrors?: typeof fieldErrors }> => {
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
          banner,
          securityInstructions: linesToInstructions(instructionsDraft),
          registrationOpen,
          ...(initial.options.length > 0
            ? { templateOptions: mergeTemplateOptions(
                  initial.storedOptions,
                  normalizeEditedOptions(initial.options, optionValues),
                ) }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.issues?.[0]?.message === "endDate < date") {
          return { fieldErrors: { endDate: "La date de fin doit être postérieure ou égale à la date de l'événement." } };
        }
        if (data?.issues?.[0]?.path?.[0] === "securityInstructions") {
          return { fieldErrors: { securityInstructions: "Consignes : 30 au plus, 500 caractères chacune." } };
        }
        if (data?.issues?.[0]?.path?.[0] === "templateOptions") {
          return {
            fieldErrors: {
              templateOptions:
                "Options du badge : valeur refusée (texte de 500 caractères au plus, 30 lignes au plus).",
            },
          };
        }
        throw res;
      }
      return {};
    },
    {
      error: "Échec de la mise à jour.",
      onSuccess: (result) => {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        else toastSuccess("Événement mis à jour.");
      },
    },
  );

  const saveSettings = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }),
      });
      if (!res.ok) throw res;
    },
    { success: "Paramètres enregistrés.", error: "Échec de l'enregistrement des paramètres." },
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Paramètres de l&apos;événement</h1>
        <p className="mt-0.5 text-sm text-slate-400">Informations, inscriptions et contact</p>
      </div>

      <Card>
        <CardHead title="Informations" />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFieldErrors({});
              void saveEvent.run();
            }}
            className="space-y-4"
          >
            <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input
                label="Date de fin (optionnelle)"
                type="date"
                value={endDate}
                error={fieldErrors.endDate}
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
                  subtitle="Format carré, 512 × 512 px conseillé (PNG à fond transparent idéal) — JPEG, PNG ou WebP, 5 Mo max"
                />
              )}
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Bannière</span>
              {banner ? (
                <FileBox
                  icon="file"
                  thumbUrl={`/api/files/${banner}`}
                  title="Bannière de l'événement"
                  subtitle={banner}
                  action={
                    <Button type="button" variant="secondary" onClick={() => setBanner(null)}>
                      Retirer
                    </Button>
                  }
                />
              ) : (
                <Dropzone
                  onFiles={uploadBanner}
                  accept="image/jpeg,image/png,image/webp"
                  title={uploadingBanner ? "Envoi…" : "Déposer une bannière ou cliquer"}
                  subtitle="Format paysage 3:1, 1500 × 500 px conseillé — JPEG, PNG ou WebP, 5 Mo max"
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
              {fieldErrors.securityInstructions && (
                <p className="mt-1 text-sm text-rose-600">{fieldErrors.securityInstructions}</p>
              )}
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
              <Button type="submit" loading={saveEvent.pending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {fieldErrors.templateOptions && <p className="text-sm text-rose-600">{fieldErrors.templateOptions}</p>}
      <BadgeOptionsFields
        options={initial.options}
        values={optionValues}
        onChange={(name, value) => setOptionValues((prev) => ({ ...prev, [name]: value }))}
        onUpload={uploadOptionImage}
      />

      <Card>
        <CardHead title="Contact (surcharges)" subtitle="Laisser vide pour hériter du niveau organisation." />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveSettings.run();
            }}
            className="space-y-4"
          >
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
              <Button type="submit" loading={saveSettings.pending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
