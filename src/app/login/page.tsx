"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push(callbackUrl ?? "/select");
    }
  }

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à votre espace de gestion."
      footer={
        <>
          Besoin d&apos;aide ?{" "}
          <a href="#" className="text-green-600 hover:underline">
            Contactez votre administrateur
          </a>
        </>
      }
    >
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
          error={error ? " " : undefined}
          placeholder="••••••••"
          required
          disabled={loading}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-[13px] text-green-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading}>
          {loading ? (
            <>
              <Spinner size={16} /> Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
