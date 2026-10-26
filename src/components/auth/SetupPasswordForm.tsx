"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PasswordMeter } from "@/components/ui/PasswordMeter";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

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
  const recaptcha = useRecaptcha();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [navigating, setNavigating] = useState(false);

  const setup = useAsyncAction(
    async () => {
      const recaptchaToken = await recaptcha.execute("setup_password");
      if (recaptcha.enabled && !recaptchaToken) {
        throw new ActionError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
      }
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ token, password, recaptchaToken: recaptchaToken ?? undefined }),
      });
      if (!res.ok) throw res;
      const data = await res.json();
      return typeof data.email === "string" ? data.email : "";
    },
    {
      error: "Une erreur est survenue",
      // Redirection sans toast ; navigating garde le bouton bloqué pendant router.push.
      onSuccess: (email) => {
        setNavigating(true);
        router.push(email ? `/login?email=${encodeURIComponent(email)}` : "/login");
      },
    },
  );
  const loading = setup.pending || navigating;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Erreurs de champ : sous les champs, sans requête.
    if (password.length < 6) {
      setFieldErrors({ password: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ confirm: "Les mots de passe ne correspondent pas." });
      return;
    }
    setFieldErrors({});
    void setup.run();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={password}
          error={fieldErrors.password}
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
        error={fieldErrors.confirm}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        autoComplete="new-password"
        disabled={loading}
      />
      <Button type="submit" className="w-full" loading={loading}>
        Activer mon compte
      </Button>
    </form>
  );
}
