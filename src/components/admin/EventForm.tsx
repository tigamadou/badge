"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

interface EventFormProps {
  initialData: EventData;
  onSubmit: (data: EventData) => Promise<void>;
}

export function EventForm({ initialData, onSubmit }: EventFormProps) {
  const [title, setTitle] = useState(initialData.title);
  const [location, setLocation] = useState(initialData.location);
  const [date, setDate] = useState(initialData.date);
  const [logo, setLogo] = useState(initialData.logo);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const { path } = await res.json();
    setLogo(path);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ title, location, date, logo });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} required />
      <Input label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
        {logo && (
          <img src={`/api/files/${logo}`} alt="Logo" className="h-16 mb-2 object-contain" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          className="text-sm"
        />
        {uploading && <p className="text-sm text-gray-500 mt-1">Upload en cours...</p>}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
