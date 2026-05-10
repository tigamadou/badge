"use client";

import { useState, useEffect } from "react";
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

export function RegistrationForm({
  onSubmit,
  submitLabel = "Soumettre",
  captchaWidget,
}: RegistrationFormProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
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
        <input type="file" name="idDocument" accept="image/*,.pdf" className="text-sm" required />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Photo d&apos;identité</label>
        <input type="file" name="photo" accept="image/*" className="text-sm" />
      </div>
      {captchaWidget}
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi en cours..." : submitLabel}
      </Button>
    </form>
  );
}
