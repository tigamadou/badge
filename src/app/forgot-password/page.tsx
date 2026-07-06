"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
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
    <AuthCard title="Mot de passe oublié">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">
            Si un compte existe pour <strong>{email}</strong>, vous recevrez un email avec un
            lien de réinitialisation. Vérifiez votre boîte de réception.
          </p>
          <p className="text-sm">
            <Link href="/login" className="text-green-600 hover:underline">Retour à la connexion</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Saisissez l&apos;adresse email de votre compte. Nous vous enverrons un lien pour
            réinitialiser votre mot de passe.
          </p>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le lien"}
          </Button>
          <p className="text-sm text-center text-slate-600">
            <Link href="/login" className="text-green-600 hover:underline">Retour à la connexion</Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
