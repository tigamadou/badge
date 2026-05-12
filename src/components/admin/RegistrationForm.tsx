"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Team {
  id: string;
  name: string;
}

const ID_DOCUMENT_TYPES = [
  { value: "CIP", label: "CIP" },
  { value: "CARTE_IDENTITE", label: "Carte d'identité" },
  { value: "PASSEPORT", label: "Passeport" },
];

interface RegistrationFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
  showCaptcha?: boolean;
  captchaWidget?: React.ReactNode;
}

const PHOTO_RATIO = 35 / 45; // 35×45mm - standard photo d'identité
const RATIO_TOLERANCE = 0.05;

function validatePhotoRatio(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      URL.revokeObjectURL(img.src);
      resolve(Math.abs(ratio - PHOTO_RATIO) <= RATIO_TOLERANCE);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(false);
    };
    img.src = URL.createObjectURL(file);
  });
}

export function RegistrationForm({
  onSubmit,
  submitLabel = "Soumettre",
  captchaWidget,
}: RegistrationFormProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [idDocFileName, setIdDocFileName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idDocInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhotoError(null);
    setIdDocError(null);

    const formData = new FormData(e.currentTarget);
    const idDocFile = formData.get("idDocument") as File | null;
    const photoFile = formData.get("photo") as File | null;

    if (!idDocFile || idDocFile.size === 0) {
      setIdDocError("Le document d'identité est obligatoire.");
      return;
    }

    if (!photoFile || photoFile.size === 0) {
      setPhotoError("La photo d'identité est obligatoire.");
      return;
    }

    if (photoFile.size > 0) {
      const valid = await validatePhotoRatio(photoFile);
      if (!valid) {
        setPhotoError("La photo doit avoir un ratio 35:45 (ex. 350×450px, 700×900px).");
        return;
      }
    }

    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom (tel que sur le document d'identité)" name="lastName" required />
      <Input label="Prénom(s) (tel que sur le document d'identité)" name="firstName" required />
      <Input label="Email" name="email" type="email" required />
      <Input label="Structure / Organisation" name="structure" required />
      <Select
        label="Catégorie"
        name="teamId"
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
        required
      />
      <Select
        label="Type de document d'identité"
        name="idDocumentType"
        options={ID_DOCUMENT_TYPES}
        required
      />
      <Input label="Numéro du document d'identité" name="idDocumentNumber" required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Document d&apos;identité (scan ou photo)</label>
        <input
          ref={idDocInputRef}
          type="file"
          name="idDocument"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => setIdDocFileName(e.target.files?.[0]?.name || null)}
        />
        <button
          type="button"
          onClick={() => idDocInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          {idDocFileName ? (
            <span className="text-sm text-slate-700 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {idDocFileName}
            </span>
          ) : (
            <span className="text-sm text-slate-500 flex flex-col items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Cliquez pour sélectionner un fichier
            </span>
          )}
        </button>
        {idDocError && <p className="text-xs text-red-600 mt-1">{idDocError}</p>}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Photo d&apos;identité</label>
        <p className="text-xs text-slate-500 mb-1">Format recommandé : ratio 35:45 (ex. 350×450px, 700×900px)</p>
        <input
          ref={photoInputRef}
          type="file"
          name="photo"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            setPhotoError(null);
            setPhotoFileName(e.target.files?.[0]?.name || null);
          }}
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          {photoFileName ? (
            <span className="text-sm text-slate-700 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {photoFileName}
            </span>
          ) : (
            <span className="text-sm text-slate-500 flex flex-col items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Cliquez pour sélectionner une photo
            </span>
          )}
        </button>
        {photoError && <p className="text-xs text-red-600 mt-1">{photoError}</p>}
      </div>
      {captchaWidget}
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi en cours..." : submitLabel}
      </Button>
    </form>
  );
}
