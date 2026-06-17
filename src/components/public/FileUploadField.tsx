"use client";

import { useState } from "react";

export type UploadedFile = { token: string; name: string; size: number };

type Props = {
  label: string;
  kind: "photo" | "document";
  slug: string;
  accept: string;
  initialName?: string;
  onUploaded: (file: UploadedFile | null) => void;
};

export function FileUploadField({ label, kind, slug, accept, initialName, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux (5 Mo max)");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload?context=event:${slug}&kind=${kind}`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.code || `HTTP ${res.status}`);
      }
      const j = await res.json();
      const u: UploadedFile = { token: j.token, name: j.originalName, size: j.size };
      setUploaded(u);
      onUploaded(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      <input type="file" accept={accept} onChange={handleChange} disabled={uploading}
             className="block w-full text-sm" />
      {uploading && <p className="text-xs text-neutral-500">Envoi en cours…</p>}
      {uploaded && <p className="text-xs text-emerald-700">Fichier envoyé : {uploaded.name}</p>}
      {!uploaded && initialName && <p className="text-xs text-neutral-500">Fichier actuel : {initialName}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
