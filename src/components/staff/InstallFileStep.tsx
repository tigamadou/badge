"use client";

import { Button } from "@/components/ui/Button";
import { Alert, ProgressBar, Spinner } from "@/components/ui/Feedback";
import { Dropzone, FileBox } from "@/components/ui/FileBox";

interface InstallFileStepProps {
  maxBytes: number;
  file: { name: string; size: number } | null;
  progress: number;
  phase: "idle" | "uploading" | "analysing" | "error";
  errors: string[];
  onFile: (file: File) => void;
  onReset: () => void;
}

// Etape 1 : choix de l'archive, envoi puis analyse. Purement presentationnelle.
export function InstallFileStep({ maxBytes, file, progress, phase, errors, onFile, onReset }: InstallFileStepProps) {
  return (
    <div className="space-y-4">
      {phase === "idle" ? (
        <Dropzone
          accept=".zip,application/zip"
          title="Déposer une archive .zip ou cliquer"
          subtitle={`Archive .zip — ${Math.round(maxBytes / 1048576)} Mo max`}
          onFiles={(files) => files[0] && onFile(files[0])}
        />
      ) : null}
      {file ? <FileBox title={file.name} subtitle={`${Math.max(1, Math.round(file.size / 1024))} Ko`} /> : null}
      {phase === "uploading" ? (
        <div className="space-y-1.5">
          <ProgressBar pct={progress} />
          <div className="text-xs text-slate-500">{progress} %</div>
        </div>
      ) : null}
      {phase === "analysing" ? (
        <div className="flex items-center gap-3">
          <Spinner size={20} />
          <span>Analyse du paquet…</span>
        </div>
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
          <Button variant="secondary" onClick={onReset}>
            Choisir un autre fichier
          </Button>
        </>
      ) : null}
    </div>
  );
}
