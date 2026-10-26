"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ActionError, toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function TestSmtpForm({ defaultEmail }: { defaultEmail?: string }) {
  const [to, setTo] = useState(defaultEmail ?? "");

  // Pas d'option `success` : le destinataire confirmé par l'API entre dans le message.
  const send = useAsyncAction(async () => {
    const res = await fetch("/api/platform/settings/test-smtp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(to ? { to } : {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Le diagnostic SMTP brut est utile au staff : on le garde dans le toast.
      throw new ActionError(`Échec : ${body.message ?? body.error ?? "erreur inconnue"}`);
    }
    toastSuccess(`E-mail de test envoyé à ${body.to}.`);
  });

  return (
    <Card className="max-w-2xl">
      <CardHead title="Tester l'envoi SMTP" subtitle="Envoie un e-mail de test avec la configuration actuelle." />
      <CardBody className="space-y-4">
        <Input
          label="Destinataire (par défaut : votre e-mail)"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="moi@example.com"
        />
        <Button variant="secondary" onClick={send.run} loading={send.pending}>
          <span className="inline-flex items-center gap-2">
            <Icon name="send" size={16} /> Envoyer un e-mail de test
          </span>
        </Button>
      </CardBody>
    </Card>
  );
}
