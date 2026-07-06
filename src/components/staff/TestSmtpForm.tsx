"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export function TestSmtpForm({ defaultEmail }: { defaultEmail?: string }) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/staff/settings/test-smtp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(to ? { to } : {}),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: `E-mail de test envoyé à ${body.to}.` });
    } else {
      setMsg({ ok: false, text: `Échec : ${body.message ?? body.error ?? "erreur inconnue"}` });
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHead title="Tester l'envoi SMTP" subtitle="Envoie un e-mail de test avec la configuration actuelle." />
      <CardBody className="space-y-4">
        {msg && <Alert tone={msg.ok ? "success" : "err"}>{msg.text}</Alert>}
        <Input
          label="Destinataire (par défaut : votre e-mail)"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="moi@example.com"
        />
        <Button variant="secondary" onClick={run} className="flex items-center justify-center gap-2" disabled={busy}>
          {busy ? (
            <>
              <Spinner size={16} /> Envoi…
            </>
          ) : (
            <>
              <Icon name="send" size={16} /> Envoyer un e-mail de test
            </>
          )}
        </Button>
      </CardBody>
    </Card>
  );
}
