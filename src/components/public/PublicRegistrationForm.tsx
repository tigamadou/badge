"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicRegistrationSchema, ID_DOC_TYPES } from "@/lib/validators/registration";
import { FileUploadField, type UploadedFile } from "./FileUploadField";

type Category = { id: string; name: string; color: string; number: number; anonymous: boolean };
type Settings = { recaptchaEnabled: boolean; recaptchaSiteKey: string };

type Props = {
  slug: string;
  categories: Category[];
  settings: Settings;
};

export function PublicRegistrationForm({ slug, categories, settings }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [structure, setStructure] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [idDocumentType, setIdDocumentType] = useState<typeof ID_DOC_TYPES[number]>("CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [document_, setDocument_] = useState<UploadedFile | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    let recaptchaToken = "";
    if (settings.recaptchaEnabled && settings.recaptchaSiteKey) {
      const grecaptcha = (window as unknown as { grecaptcha?: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha;
      if (grecaptcha) {
        recaptchaToken = await grecaptcha.execute(settings.recaptchaSiteKey, { action: "register" });
      }
    }

    const payload = {
      email, firstName, lastName, structure, categoryId,
      idDocumentType, idDocumentNumber,
      photoToken: photo?.token ?? "",
      idDocumentToken: document_?.token ?? "",
      recaptchaToken,
    };
    const parsed = publicRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError("Merci de vérifier les champs : " + parsed.error.issues.map(i => i.message).join(", "));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/events/${slug}/registrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setServerError(translateServerCode(j.code, res.status));
        return;
      }
      router.push(`/e/${slug}/success`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      {serverError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      )}

      <Field label="Email" value={email} onChange={setEmail} type="email" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" value={firstName} onChange={setFirstName} required />
        <Field label="Nom" value={lastName} onChange={setLastName} required />
      </div>
      <Field label="Structure" value={structure} onChange={setStructure} required />

      <fieldset>
        <legend className="block text-sm font-medium text-neutral-800">Catégorie</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded border p-2 ${categoryId === c.id ? "ring-2 ring-blue-500" : ""}`}>
              <input type="radio" name="category" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} />
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Type de pièce</label>
          <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value as typeof ID_DOC_TYPES[number])} className="mt-1 block w-full rounded border-neutral-300">
            {ID_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Field label="Numéro de pièce" value={idDocumentNumber} onChange={setIdDocumentNumber} required />
      </div>

      <FileUploadField label="Photo (JPEG/PNG/WebP, 5 Mo max)" kind="photo" slug={slug}
        accept="image/jpeg,image/png,image/webp" onUploaded={setPhoto} />
      <FileUploadField label="Pièce d'identité (JPEG/PNG/WebP/PDF, 5 Mo max)" kind="document" slug={slug}
        accept="image/jpeg,image/png,image/webp,application/pdf" onUploaded={setDocument_} />

      <button type="submit" disabled={submitting || !photo || !document_} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {submitting ? "Envoi…" : "Envoyer mon inscription"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required}
             className="mt-1 block w-full rounded border-neutral-300" />
    </div>
  );
}

function translateServerCode(code: string | undefined, status: number): string {
  switch (code) {
    case "QUOTA_EXCEEDED": return "Les inscriptions sont complètes.";
    case "EMAIL_BLOCKED": return "Cet email ne peut pas être utilisé pour cet événement.";
    case "DOCUMENT_BLOCKED": return "Ce numéro de pièce ne peut pas être utilisé pour cet événement.";
    case "RATE_LIMITED": return "Trop de tentatives. Réessayez dans une minute.";
    case "VALIDATION": return "Merci de vérifier les informations saisies.";
    default:
      if (code?.startsWith("RECAPTCHA_")) return "Vérification anti-spam échouée. Rechargez la page.";
      if (code?.startsWith("UPLOAD_TOKEN_")) return "Les fichiers envoyés ne sont plus valides. Rechargez et renvoyez.";
      return `Une erreur est survenue (${code ?? status}).`;
  }
}
