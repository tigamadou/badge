"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { useRecaptcha } from "@/components/auth/Recaptcha";
import { SuccessRing } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export default function ForgotPasswordPage() {
  const recaptcha = useRecaptcha();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const send = useAsyncAction(
    async () => {
      const recaptchaToken = await recaptcha.execute("forgot_password");
      if (recaptcha.enabled && !recaptchaToken) {
        throw new ActionError("La vérification anti-spam n'a pas pu démarrer. Rechargez la page et réessayez.");
      }
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // null (reCAPTCHA desactive) -> champ omis : le serveur n'accepte qu'une chaine.
        body: JSON.stringify({ email, recaptchaToken: recaptchaToken ?? undefined }),
      });
      if (!res.ok) throw res;
    },
    // Anti-enumeration : reponse toujours uniforme ; l'écran « done » tient lieu de retour.
    { error: "Erreur, réessayez.", onSuccess: () => setDone(true) },
  );
  const loading = send.pending;

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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send.run();
          }}
          className="space-y-4"
        >          <Input
            label="Adresse e-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@organisation.fr"
            required
            autoComplete="email"
            disabled={loading}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
