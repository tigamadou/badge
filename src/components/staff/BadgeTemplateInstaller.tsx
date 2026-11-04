"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ARCHIVE_BYTES } from "@tigamadou/pdf-engine/package";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Stepper } from "@/components/ui/Stepper";
import { checkArchiveFile } from "@/lib/archive-check";
import { uploadWithProgress } from "@/lib/upload-with-progress";
import { InstallFileStep } from "./InstallFileStep";
import { InstallSummaryStep, type InstallSummary } from "./InstallSummaryStep";
import { closeConfirmation, initialInstallState, installReducer, shouldRefreshAfterClose } from "./install-machine";

type ErrorBody = { errors?: string[] } | null;

function errorsOf(json: unknown, fallback: string): string[] {
  const errors = (json as ErrorBody)?.errors;
  return errors && errors.length > 0 ? errors : [fallback];
}

export function BadgeTemplateInstaller() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(installReducer, initialInstallState);
  // Requete en cours : annulee a la fermeture de la modale.
  const controllerRef = useRef<AbortController | null>(null);

  // Annule la requete en cours au demontage.
  useEffect(() => () => controllerRef.current?.abort(), []);

  function newController(): AbortController {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }

  async function onFile(file: File) {
    const refused = checkArchiveFile(file, MAX_ARCHIVE_BYTES);
    if (refused) {
      dispatch({ type: "reject", error: refused });
      return;
    }
    dispatch({ type: "pick", file });
    const controller = newController();
    const form = new FormData();
    form.set("archive", file);
    try {
      const { status, json } = await uploadWithProgress(
        "/api/platform/badge-templates/inspect",
        form,
        (pct) => {
          dispatch({ type: "progress", pct });
          if (pct >= 100) dispatch({ type: "uploaded" });
        },
        controller.signal,
      );
      if (status === 200) {
        const body = json as InstallSummary;
        const summary: InstallSummary = {
          family: body.family,
          label: body.label,
          pages: body.pages,
          nextVersion: body.nextVersion,
          preview: body.preview,
          contractVariables: body.contractVariables,
          options: body.options,
        };
        dispatch({ type: "inspected", summary });
      } else {
        dispatch({ type: "failed", errors: errorsOf(json, "La lecture du paquet a échoué.") });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "failed", errors: ["Échec de l'envoi"] });
    }
  }

  async function onInstall() {
    if (!state.file) return;
    dispatch({ type: "install" });
    const controller = newController();
    const form = new FormData();
    form.set("archive", state.file);
    try {
      const { status, json } = await uploadWithProgress(
        "/api/platform/badge-templates",
        form,
        (pct) => dispatch({ type: "progress", pct }),
        controller.signal,
      );
      if (status === 201) {
        dispatch({ type: "installed", version: (json as { version: number }).version });
        router.refresh();
      } else {
        dispatch({ type: "failed", errors: errorsOf(json, "L'installation a échoué.") });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "failed", errors: ["Échec de l'envoi"] });
    }
  }

  function close() {
    const message = closeConfirmation(state);
    if (message && !window.confirm(message)) return;
    controllerRef.current?.abort();
    // Le serveur a pu installer malgre l'abandon : recharger le catalogue.
    if (shouldRefreshAfterClose(state)) router.refresh();
    dispatch({ type: "reset" });
    setOpen(false);
  }

  function reset() {
    controllerRef.current?.abort();
    dispatch({ type: "reset" });
  }

  const { phase } = state;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-navy">Installer un template</h2>
      <p className="mt-1 text-xs text-slate-600">
        Archive ZIP contenant <code>manifest.json</code> à la racine, et si besoin les dossiers{" "}
        <code>assets/</code> (JPEG, PNG) et <code>fonts/</code> (TTF, OTF).
      </p>
      <div className="mt-3">
        <Button onClick={() => setOpen(true)}>Installer un template</Button>
      </div>

      <Dialog open={open} title="Installer un template" onClose={close}>
        <Stepper steps={["Fichier", "Récapitulatif"]} current={state.step} />
        {state.step === 0 || !state.summary ? (
          <InstallFileStep
            maxBytes={MAX_ARCHIVE_BYTES}
            file={state.file}
            progress={state.progress}
            phase={phase as "idle" | "uploading" | "analysing" | "error"}
            errors={state.errors}
            onFile={onFile}
            onReset={reset}
          />
        ) : (
          <InstallSummaryStep
            summary={state.summary}
            phase={phase as "summary" | "installing" | "done" | "error"}
            progress={state.progress}
            errors={state.errors}
            installedVersion={state.installedVersion}
            onInstall={onInstall}
            onRetry={onInstall}
            onReset={reset}
            onClose={close}
          />
        )}
      </Dialog>
    </div>
  );
}
