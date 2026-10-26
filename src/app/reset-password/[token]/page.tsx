"use client";

import { useState, use } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { SuccessRing } from "@/components/ui/Feedback";
import { PasswordMeter } from "@/components/ui/PasswordMeter";
import { Icon } from "@/components/ui/Icon";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

function pwScore(v: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) s++;
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}
const PW_LABEL = ["très faible", "faible", "moyenne", "correcte", "forte"];

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const recaptcha = useRecaptcha();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);

  const reset = useAsyncAction(
    async () => {
      const recaptchaToken = await recaptcha.execute("reset_password");
      if (recaptcha.enabled && !recaptchaToken) {
        throw new ActionError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
      }
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ token, password, recaptchaToken: recaptchaToken ?? undefined }),
      });
      if (!res.ok) throw res;
    },
    { error: "Lien invalide ou expiré.", onSuccess: () => setDone(true) },
  );
  const loading = reset.pending;

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
    void reset.run();
  }

  return (
    <AuthCard
      title={done ? "Mot de passe mis à jour" : "Nouveau mot de passe"}
      subtitle={done ? undefined : "Choisissez un mot de passe pour votre compte."}
    >
      {done ? (
        <div className="text-center">
          <SuccessRing>
            <Icon name="check" size={34} />
          </SuccessRing>
          <p className="text-sm text-slate-600">
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={password}
              error={fieldErrors.password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            value={confirm}
            error={fieldErrors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Mettre à jour
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
