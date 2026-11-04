"use client";

import { Button } from "@/components/ui/Button";
import { Alert, ProgressBar, Spinner } from "@/components/ui/Feedback";
import { TemplatePreview } from "@/components/ui/TemplatePreview";

export type InstallSummary = {
  family: string;
  label: string;
  pages: number;
  nextVersion: number;
  preview: string | null;
  contractVariables: Array<{ name: string; kind: string; label: string }>;
  options: Array<{ name: string; kind: string; label: string }>;
};

// Libelles francais des types d'options ; un type inconnu s'affiche tel quel.
const OPTION_KIND_LABELS: Record<string, string> = {
  text: "texte",
  image: "image",
  boolean: "booléen",
  date: "date",
  color: "couleur",
  list: "liste",
};

interface InstallSummaryStepProps {
  summary: InstallSummary;
  phase: "summary" | "installing" | "done" | "error";
  progress: number;
  errors: string[];
  installedVersion: number | null;
  onInstall: () => void;
  onRetry: () => void;
  onReset: () => void;
  onClose: () => void;
}

// Etape 2 : recapitulatif du paquet analyse, installation et resultat. Purement presentationnelle.
export function InstallSummaryStep({
  summary,
  phase,
  progress,
  errors,
  installedVersion,
  onInstall,
  onRetry,
  onReset,
  onClose,
}: InstallSummaryStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex h-24 w-32 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-mist">
          <TemplatePreview src={summary.preview ?? ""} label={summary.label} />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{summary.label}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            <code>{summary.family}</code> · {summary.pages} page(s) · version {summary.nextVersion}
          </div>
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-slate-700">
          Données de badge ({summary.contractVariables.length})
        </summary>
        <ul className="mt-2 space-y-1 text-[13px]">
          {summary.contractVariables.map((v) => (
            <li key={v.name} className="flex justify-between gap-3">
              <span>{v.label}</span>
              <code className="text-xs text-slate-400">{v.name}</code>
            </li>
          ))}
        </ul>
      </details>

      {summary.options.length > 0 ? (
        <details className="rounded-lg border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-slate-700">
            Options du template ({summary.options.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[13px]">
            {summary.options.map((o) => (
              <li key={o.name} className="flex justify-between gap-3">
                <span>{o.label}</span>
                <span className="text-xs text-slate-400">{OPTION_KIND_LABELS[o.kind] ?? o.kind}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Chaque option est réglée par événement dans les paramètres de l&apos;événement.
          </p>
        </details>
      ) : null}

      {phase === "summary" ? <Button onClick={onInstall}>Installer</Button> : null}

      {phase === "installing" ? (
        progress < 100 ? (
          <div className="space-y-1.5">
            <ProgressBar pct={progress} />
            <div className="text-xs text-slate-500">{progress} %</div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Spinner size={20} />
            <span>Installation et rendu d&apos;épreuve…</span>
          </div>
        )
      ) : null}

      {phase === "done" ? (
        <>
          <Alert tone="success">Template installé (version {installedVersion})</Alert>
          <Button onClick={onClose}>Fermer</Button>
        </>
      ) : null}

      {phase === "error" ? (
        <>
          <Alert tone="err">
            <ul className="list-disc space-y-1 pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
          <div className="flex gap-3">
            <Button onClick={onRetry}>Réessayer</Button>
            <Button variant="secondary" onClick={onReset}>
              Choisir un autre fichier
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
