"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Category = {
  id: string;
  name: string;
  color: string;
  number: number;
};

export default function RegisterEventForm({
  slug,
  categories,
}: {
  slug: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Vous devez confirmer l'utilisation de vos données.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data?.registrationId) {
          router.push(`/account/registrations/${data.registrationId}`);
          return;
        }
        setError(data?.error ?? "Inscription impossible.");
        return;
      }
      router.push(`/e/${slug}/success?id=${encodeURIComponent(data.id)}`);
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
        <div className="space-y-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                categoryId === c.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
                className="text-indigo-600"
              />
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="text-sm text-gray-900">{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Je confirme que les informations de mon profil (identité, structure, photo, pièce
          d&apos;identité) seront utilisées pour cette inscription et la production de mon badge.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading || !categoryId}>
        {loading ? "Inscription..." : "Valider mon inscription"}
      </Button>
    </form>
  );
}
