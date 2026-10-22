"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/RadioCards";
import { Checkbox, FormSection } from "@/components/ui/FormControls";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { useRecaptcha } from "@/components/auth/Recaptcha";

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
  const recaptcha = useRecaptcha();
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
      const recaptchaToken = await recaptcha.execute("event_register");
      if (recaptcha.enabled && !recaptchaToken) {
        setError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
        return;
      }
      const res = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ categoryId, recaptchaToken: recaptchaToken ?? undefined }),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Catégorie de participation" description="Sélectionnez la catégorie qui vous correspond.">
        <RadioCards
          name="Catégorie"
          value={categoryId || null}
          onChange={setCategoryId}
          options={categories.map((c) => ({ value: c.id, title: c.name, color: c.color }))}
        />
      </FormSection>

      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        label={
          <>
            Je confirme que les informations de mon profil (identité, structure, photo, pièce d&apos;identité) seront
            utilisées pour cette inscription et la production de mon badge.
          </>
        }
      />

      {error && (
        <Alert tone="err">{error}</Alert>
      )}

      <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading || !categoryId}>
        {loading ? (
          <>
            <Spinner size={16} /> Inscription…
          </>
        ) : (
          "S'inscrire"
        )}
      </Button>
    </form>
  );
}
