"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { Segmented } from "@/components/ui/Tabs";
import { Checkbox } from "@/components/ui/FormControls";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Icon } from "@/components/ui/Icon";

type Template = { id: string; name: string; color: string; number: number };
type ManualCategory = {
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
};

type CreatePayload = {
  title: string;
  date: string;
  endDate?: string | null;
  description?: string | null;
  location: string;
  slug?: string;
  templateIds?: string[];
  manualCategories?: ManualCategory[];
};

const STEPS = ["Informations", "Catégories", "Récapitulatif"];

export function EventCreationWizard({
  orgId,
  templates,
}: {
  orgId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [mode, setMode] = useState<"template" | "manual">("template");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [manualCats, setManualCats] = useState<ManualCategory[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function suggestedSlug(t: string): string {
    return t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(suggestedSlug(v));
  }

  function step1Valid() {
    return title.trim() && date && location.trim();
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    const body: CreatePayload = { title, date, location };
    if (endDate) body.endDate = endDate;
    if (description.trim()) body.description = description;
    if (slug && slugTouched) body.slug = slug;
    if (mode === "template") body.templateIds = selectedTemplates;
    if (mode === "manual") body.manualCategories = manualCats;

    const res = await fetch(`/api/org/${orgId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { code?: string };
      if (json.code === "EVENT_LIMIT") {
        setErr("Limite d'événements du plan atteinte. Contactez le support pour changer d'abonnement.");
      } else if (json.code === "SUBSCRIPTION_INACTIVE" || json.code === "NO_SUBSCRIPTION") {
        setErr("Votre abonnement n'est pas actif. Contactez le support.");
      } else if (json.code === "SLUG_TAKEN") {
        setErr("Ce slug est déjà utilisé. Modifiez-le et réessayez.");
      } else if ((json as { issues?: { message?: string }[] }).issues?.[0]?.message === "endDate < date") {
        setErr("La date de fin doit être postérieure ou égale à la date de l'événement.");
      } else {
        setErr("Erreur lors de la création.");
      }
      return;
    }
    const json = (await res.json()) as { event: { id: string; slug: string } };
    router.push(`/event/${json.event.id}/settings`);
  }

  function addManualCategory() {
    setManualCats([
      ...manualCats,
      {
        name: "",
        color: "#0066cc",
        number: manualCats.length + 1,
        neutralBadge: false,
        anonymous: false,
      },
    ]);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Nouvel événement</h1>

      <Stepper steps={STEPS} current={step - 1} />

      {err && (
        <Alert tone="err">
          <Icon name="alert-triangle" size={16} /> {err}
        </Alert>
      )}

      {step === 1 && (
        <Card>
          <CardBody className="space-y-4">
            <Input label="Titre" value={title} onChange={(e) => onTitleChange(e.target.value)} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input
                label="Date de fin (optionnelle)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} required />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Description (optionnelle)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <Input
                label="Slug (URL publique)"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
              />
              <p className="mt-1 text-xs text-slate-400">
                Suggéré automatiquement à partir du titre. Si le slug existe déjà globalement, un suffixe -2, -3… sera
                ajouté à la création.
              </p>
            </div>
            <div className="flex justify-end">
              <Button disabled={!step1Valid()} onClick={() => setStep(2)}>
                Continuer
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardBody className="space-y-4">
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as "template" | "manual")}
              options={[
                { value: "template", label: "Depuis un modèle" },
                { value: "manual", label: "Manuelles" },
              ]}
            />

            {mode === "template" && (
              <div className="space-y-2">
                {templates.length === 0 && (
                  <p className="text-sm text-slate-400">
                    Aucun modèle disponible. Créez-en un dans Modèles catégories ou passez en manuel.
                  </p>
                )}
                {templates.map((t) => (
                  <Checkbox
                    key={t.id}
                    checked={selectedTemplates.includes(t.id)}
                    onChange={(on) => {
                      if (on) setSelectedTemplates([...selectedTemplates, t.id]);
                      else setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                    }}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded" style={{ background: t.color }} />
                        {t.name} <span className="text-slate-400">#{t.number}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            )}

            {mode === "manual" && (
              <div className="space-y-2">
                {manualCats.map((c, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <Input
                      label={i === 0 ? "Nom" : undefined}
                      placeholder="Nom"
                      value={c.name}
                      onChange={(e) => {
                        const next = [...manualCats];
                        next[i] = { ...next[i], name: e.target.value };
                        setManualCats(next);
                      }}
                    />
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => {
                        const next = [...manualCats];
                        next[i] = { ...next[i], color: e.target.value };
                        setManualCats(next);
                      }}
                      className="h-9 w-12 rounded-lg border border-slate-300"
                    />
                    <Input
                      type="number"
                      value={c.number}
                      onChange={(e) => {
                        const next = [...manualCats];
                        next[i] = { ...next[i], number: Number(e.target.value) };
                        setManualCats(next);
                      }}
                      className="w-20"
                    />
                  </div>
                ))}
                <Button variant="secondary" onClick={addManualCategory}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="plus" size={16} /> Ajouter une catégorie
                  </span>
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Précédent
              </Button>
              <Button onClick={() => setStep(3)}>Continuer</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardBody className="space-y-4">
            <KeyValue
              items={[
                { label: "Titre", value: title },
                { label: "Date", value: date },
                { label: "Lieu", value: location },
                { label: "Slug", value: slug || "(auto)" },
                {
                  label: "Catégories",
                  value:
                    mode === "template"
                      ? `${selectedTemplates.length} modèle(s) sélectionné(s)`
                      : `${manualCats.length} manuelle(s)`,
                },
              ]}
            />
            <p className="text-xs text-slate-400">
              L&apos;événement sera créé avec les inscriptions fermées par défaut. Vous pourrez les ouvrir depuis la page
              de configuration.
            </p>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Précédent
              </Button>
              <Button onClick={submit} className="flex items-center justify-center gap-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner size={16} /> Création…
                  </>
                ) : (
                  "Créer l'événement"
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
