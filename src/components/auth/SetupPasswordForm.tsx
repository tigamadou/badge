"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { PasswordMeter } from "@/components/ui/PasswordMeter";
import { Icon } from "@/components/ui/Icon";

type Props = {
  token: string;
};

function pwScore(v: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) s++;
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}
const PW_LABEL = ["très faible", "faible", "moyenne", "correcte", "forte"];

export default function SetupPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }
      const email = typeof data.email === "string" ? data.email : "";
      const url = email ? `/login?email=${encodeURIComponent(email)}` : "/login";
      router.push(url);
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert tone="err">
          <Icon name="alert-triangle" size={16} /> {error}
        </Alert>
      )}
      <div>
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={loading}
        />
        <PasswordMeter score={pwScore(password)} />
        {password && (
          <p className="-mt-1 text-[13px] text-slate-500">
            Robustesse :{" "}
            <b className={pwScore(password) >= 3 ? "text-green-700" : "text-rose-700"}>{PW_LABEL[pwScore(password)]}</b>
          </p>
        )}
      </div>
      <Input
        label="Confirmer le mot de passe"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        autoComplete="new-password"
        disabled={loading}
      />
      <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading}>
        {loading ? (
          <>
            <Spinner size={16} /> Configuration…
          </>
        ) : (
          "Activer mon compte"
        )}
      </Button>
    </form>
  );
}
