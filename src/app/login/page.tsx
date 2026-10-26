"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { safeInternalPath } from "@/lib/safe-path";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  // v4 (plan 09) : `callbackUrl` etait emis par plusieurs pages mais jamais lu ici,
  // ce qui renvoyait tout le monde sur /select et cassait le fil de l'inscription.
  const callbackUrl = safeInternalPath(useSearchParams().get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [navigating, setNavigating] = useState(false);

  // « Identifiants incorrects » reste inline : l'erreur concerne les deux champs, qui gardent leur bordure rouge.
  const login = useAsyncAction(
    async () => {
      const res = await signIn("credentials", { email, password, redirect: false });
      return !res?.error;
    },
    {
      error: "Connexion impossible. Réessayez.",
      // pending repasse à false avant la fin de la navigation : navigating garde le formulaire bloqué.
      onSuccess: (ok) => {
        if (!ok) {
          setError("Email ou mot de passe incorrect");
          return;
        }
        setNavigating(true);
        router.push(callbackUrl ?? "/select");
      },
    },
  );
  const loading = login.pending || navigating;

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à votre espace de gestion."
      footer={
        <>
          Besoin d&apos;aide ?{" "}
          <a href="mailto:contact@badge.app" className="text-green-600 hover:underline">
            Contactez votre administrateur
          </a>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          void login.run();
        }}
        className="space-y-4"
      >        <Input
          label="Adresse e-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ? " " : undefined}
          placeholder="vous@organisation.fr"
          required
          disabled={loading}
        />
        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
          placeholder="••••••••"
          required
          disabled={loading}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-[13px] text-green-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
