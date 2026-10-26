"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { safeInternalPath } from "@/lib/safe-path";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);

  const register = useAsyncAction(
    async () => {
      const recaptchaToken = await recaptcha.execute("register");
      if (recaptcha.enabled && !recaptchaToken) {
        throw new ActionError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ email, password, name, next, recaptchaToken: recaptchaToken ?? undefined }),
      });
      if (!res.ok) throw res;
    },
    // Succès : l'écran « Compte créé » tient lieu de retour.
    { error: "Inscription impossible.", onSuccess: () => setDone(true) },
  );
  const loading = register.pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Erreurs de champ : sous les champs, sans requête.
    if (password.length < 6) {
      setFieldErrors({ password: "Le mot de passe doit faire au moins 6 caractères." });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: "Les mots de passe ne correspondent pas." });
      return;
    }
    setFieldErrors({});
    void register.run();
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
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            value={confirm}
            error={fieldErrors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" className="w-full" loading={loading}>
            Créer mon compte
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
