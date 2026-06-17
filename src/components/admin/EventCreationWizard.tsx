"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  location: string;
  slug?: string;
  templateIds?: string[];
  manualCategories?: ManualCategory[];
};

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
    if (slug && slugTouched) body.slug = slug;
    if (mode === "template") body.templateIds = selectedTemplates;
    if (mode === "manual") body.manualCategories = manualCats;

    const res = await fetch(`/api/admin/${orgId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { code?: string };
      if (json.code === "QUOTA_EXCEEDED") {
        setErr("Limite atteinte. Contactez le support pour augmenter votre quota.");
      } else if (json.code === "SLUG_TAKEN") {
        setErr("Ce slug est déjà utilisé. Modifiez-le et réessayez.");
      } else {
        setErr("Erreur lors de la création.");
      }
      return;
    }
    const json = (await res.json()) as { event: { id: string; slug: string } };
    router.push(`/admin/${orgId}/events/${json.event.id}/settings`);
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
      <h1 className="text-2xl font-bold">Nouvel événement</h1>

      <ol className="flex gap-4 text-sm">
        <li className={step === 1 ? "font-bold" : "text-gray-500"}>1. Informations</li>
        <li className={step === 2 ? "font-bold" : "text-gray-500"}>2. Catégories</li>
        <li className={step === 3 ? "font-bold" : "text-gray-500"}>3. Récap</li>
      </ol>

      {err && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {step === 1 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <Input
            placeholder="Titre"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input
            placeholder="Lieu"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <div>
            <label className="text-sm text-gray-600">Slug (URL publique)</label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Suggéré automatiquement à partir du titre. Si le slug existe déjà globalement, un
              suffixe -2, -3… sera ajouté à la création.
            </p>
          </div>
          <div className="flex justify-end">
            <Button disabled={!step1Valid()} onClick={() => setStep(2)}>
              Suivant
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant={mode === "template" ? "primary" : "secondary"}
              onClick={() => setMode("template")}
            >
              Partir d&apos;un modèle
            </Button>
            <Button
              variant={mode === "manual" ? "primary" : "secondary"}
              onClick={() => setMode("manual")}
            >
              Définir manuellement
            </Button>
          </div>

          {mode === "template" && (
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-gray-500">
                  Aucun modèle disponible. Créez-en un dans Modèles catégories ou passez en manuel.
                </p>
              )}
              {templates.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTemplates([...selectedTemplates, t.id]);
                      else setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                    }}
                  />
                  <span
                    className="inline-block w-3 h-3 rounded"
                    style={{ background: t.color }}
                  />
                  {t.name} (#{t.number})
                </label>
              ))}
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-2">
              {manualCats.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nom"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...manualCats];
                      next[i] = { ...next[i], name: e.target.value };
                      setManualCats(next);
                    }}
                  />
                  <Input
                    type="color"
                    value={c.color}
                    onChange={(e) => {
                      const next = [...manualCats];
                      next[i] = { ...next[i], color: e.target.value };
                      setManualCats(next);
                    }}
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
                Ajouter une catégorie
              </Button>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button onClick={() => setStep(3)}>Suivant</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="font-semibold">Récap</h2>
          <dl className="text-sm space-y-1">
            <div>
              <dt className="inline font-medium">Titre : </dt>
              <dd className="inline">{title}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Date : </dt>
              <dd className="inline">{date}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Lieu : </dt>
              <dd className="inline">{location}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Slug : </dt>
              <dd className="inline">{slug || "(auto)"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Catégories : </dt>
              <dd className="inline">
                {mode === "template"
                  ? `${selectedTemplates.length} modèle(s) sélectionné(s)`
                  : `${manualCats.length} manuelle(s)`}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-500">
            L&apos;événement sera créé avec les inscriptions fermées par défaut. Vous pourrez les
            ouvrir depuis la page de configuration.
          </p>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Création..." : "Créer l'événement"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
