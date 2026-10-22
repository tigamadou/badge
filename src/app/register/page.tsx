"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { safeInternalPath } from "@/lib/safe-path";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  // v4 (plan 09) : la page publique d'un evenement passe `next`. On le porte jusqu'a
  // l'API, qui l'inscrit dans le lien de verification.
  const next = safeInternalPath(useSearchParams().get("next"));
  const recaptcha = useRecaptcha();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const recaptchaToken = await recaptcha.execute("register");
      if (recaptcha.enabled && !recaptchaToken) {
        setError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ email, password, name, next, recaptchaToken: recaptchaToken ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Inscription impossible.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Créer un compte">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-green-700 font-medium">Compte créé.</p>
          <p className="text-sm text-slate-700">
            Nous vous avons envoyé un email à <strong>{email}</strong> pour confirmer votre adresse.
            {next
              ? " Cliquez sur le lien reçu pour activer votre compte et reprendre votre inscription."
              : " Cliquez sur le lien reçu pour activer votre compte."}
          </p>
          {!next && (
            <p className="text-sm">
              <Link href="/login" className="text-green-600 hover:underline">Retour à la connexion</Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom complet"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Mot de passe (min. 6 caractères)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
          <p className="text-sm text-center text-slate-600">
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-green-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
