"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { Alert, Spinner, SuccessRing } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export default function ForgotPasswordPage() {
  const recaptcha = useRecaptcha();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const recaptchaToken = await recaptcha.execute("forgot_password");
      if (recaptcha.enabled && !recaptchaToken) {
        setError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
        return;
      }
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ email, recaptchaToken: recaptchaToken ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur, réessayez.");
        return;
      }
      // Anti-enumeration : reponse toujours uniforme (success message).
      setDone(true);
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={done ? "Vérifiez votre boîte mail" : "Mot de passe oublié"}
      subtitle={done ? undefined : "Saisissez votre e-mail pour recevoir un lien de réinitialisation."}
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 text-green-600 hover:underline">
          <Icon name="arrow-left" size={13} /> Retour à la connexion
        </Link>
      }
    >
      {done ? (
        <div className="text-center">
          <SuccessRing>
            <Icon name="mail" size={26} />
          </SuccessRing>
          <p className="text-sm text-slate-600">
            Si un compte existe pour <b className="text-slate-900">{email}</b>, un lien de réinitialisation a été envoyé.
          </p>
          <Button variant="secondary" className="mt-6 w-full" onClick={() => setDone(false)}>
            Renvoyer l&apos;e-mail
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert tone="err">
              <Icon name="alert-triangle" size={16} /> {error}
            </Alert>
          )}
          <Input
            label="Adresse e-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@organisation.fr"
            required
            autoComplete="email"
            disabled={loading}
          />
          <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading}>
            {loading ? (
              <>
                <Spinner size={16} /> Envoi…
              </>
            ) : (
              "Envoyer le lien"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
