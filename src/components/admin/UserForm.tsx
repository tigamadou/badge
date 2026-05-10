"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface UserFormProps {
  initialData?: { id: string; email: string; name: string; role: string };
  onSubmit: (data: { email: string; name: string; role: string; password?: string }) => Promise<void>;
  onCancel: () => void;
}

const roleOptions = [
  { value: "OPERATOR", label: "Opérateur" },
  { value: "ADMIN", label: "Admin" },
];

export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const [email, setEmail] = useState(initialData?.email || "");
  const [name, setName] = useState(initialData?.name || "");
  const [role, setRole] = useState(initialData?.role || "OPERATOR");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data: { email: string; name: string; role: string; password?: string } = { email, name, role };
    if (password) data.password = password;
    await onSubmit(data);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input
        label={initialData ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe (optionnel — un email d'invitation sera envoyé)"}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Select label="Rôle" options={roleOptions} value={role} onChange={(e) => setRole(e.target.value)} />
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : initialData ? "Modifier" : "Créer"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
