"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

const noopSubscribe = () => () => {};

export function PublicLinkCard({
  path,
  fallbackBaseUrl,
  registrationOpen,
}: {
  path: string;
  fallbackBaseUrl: string;
  registrationOpen: boolean;
}) {
  // L'origine du navigateur prime sur BASE_URL/NEXTAUTH_URL : le lien copie pointe
  // ainsi vers le domaine reellement utilise (dev, preprod, prod). Le fallback serveur
  // sert au rendu initial pour eviter tout ecart d'hydratation.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => fallbackBaseUrl,
  );
  const [copied, setCopied] = useState(false);

  const url = `${origin}${path}`;

  function copy() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <CardHead
        title="Lien d'inscription public"
        subtitle={
          registrationOpen
            ? "À partager avec les participants."
            : "Inscriptions fermées : la page affiche un message de fermeture."
        }
      />
      <CardBody className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Lien d'inscription public"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-mist px-3 py-2 font-mono text-[13px] text-slate-600"
        />
        <Button variant="secondary" onClick={copy} className="flex items-center gap-1.5">
          <Icon name="copy" size={14} /> {copied ? "Copié" : "Copier"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-mist px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-line"
        >
          <Icon name="external-link" size={14} /> Ouvrir
        </a>
      </CardBody>
    </Card>
  );
}
