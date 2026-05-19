"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
  registrationOpen?: boolean;
}

interface EventFormProps {
  initialData: EventData;
  onSubmit: (data: EventData) => Promise<void>;
  showRegistrationToggle?: boolean;
}

function toInputDate(date: string): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export function EventForm({ initialData, onSubmit, showRegistrationToggle }: EventFormProps) {
  const [title, setTitle] = useState(initialData.title);
  const [location, setLocation] = useState(initialData.location);
  const [date, setDate] = useState(toInputDate(initialData.date));
  const [logo, setLogo] = useState(initialData.logo);
  const [registrationOpen, setRegistrationOpen] = useState(initialData.registrationOpen ?? true);
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
    await onSubmit({ title, location, date, logo, registrationOpen });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} required />
      <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
        {logo && (
          <img src={`/api/files/${logo}`} alt="Logo" className="h-16 mb-2 object-contain" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          className="text-sm"
        />
        {uploading && <p className="text-sm text-slate-500 mt-1">Upload en cours...</p>}
      </div>
      {showRegistrationToggle && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Inscriptions publiques</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {registrationOpen
                  ? "Le formulaire d\u2019inscription est ouvert aux visiteurs."
                  : "Un message indiquant que les inscriptions sont fermées est affiché."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegistrationOpen(!registrationOpen)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                registrationOpen ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  registrationOpen ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
