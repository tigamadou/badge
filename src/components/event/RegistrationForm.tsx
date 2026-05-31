"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Category = { id: string; name: string; number: number };

export function RegistrationForm({
  orgId,
  eventId,
  categories,
  initial,
}: {
  orgId: string;
  eventId: string;
  categories: Category[];
  initial?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    structure: string;
    categoryId: string;
    idDocumentType: string;
    idDocumentNumber: string;
    photo: string | null;
    idDocument: string | null;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [structure, setStructure] = useState(initial?.structure ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [idDocumentType, setIdDocumentType] = useState(initial?.idDocumentType ?? "CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState(initial?.idDocumentNumber ?? "");
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const [idDocument, setIdDocument] = useState<string | null>(initial?.idDocument ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const url = initial
      ? `/api/admin/${orgId}/events/${eventId}/registrations/${initial.id}`
      : `/api/admin/${orgId}/events/${eventId}/registrations`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        structure,
        categoryId,
        idDocumentType,
        idDocumentNumber,
        photo,
        idDocument,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Échec de l'enregistrement.");
      setBusy(false);
      return;
    }
    const json = await res.json();
    router.push(`/admin/${orgId}/events/${eventId}/registrations/${initial?.id ?? json.registration.id}`);
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3 max-w-xl">
      <h2 className="text-xl font-semibold">{initial ? "Modifier l'inscription" : "Nouvelle inscription"}</h2>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" required />
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" required />
      </div>
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <Input value={structure} onChange={(e) => setStructure(e.target.value)} placeholder="Structure / organisation" required />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.number} — {c.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="CNI">CNI</option>
          <option value="PASSPORT">Passeport</option>
          <option value="DRIVER_LICENSE">Permis de conduire</option>
          <option value="OTHER">Autre</option>
        </select>
        <Input value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} placeholder="N° de pièce" required />
      </div>
      <Input value={photo ?? ""} onChange={(e) => setPhoto(e.target.value || null)} placeholder="Chemin photo (uploads/...)" />
      <Input value={idDocument ?? ""} onChange={(e) => setIdDocument(e.target.value || null)} placeholder="Chemin pièce d'identité" />
      <Button type="submit" disabled={busy}>
        {busy ? "..." : initial ? "Mettre à jour" : "Créer"}
      </Button>
    </form>
  );
}
