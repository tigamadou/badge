import type { InstallSummary } from "./InstallSummaryStep";

export type InstallState = {
  phase: "idle" | "uploading" | "analysing" | "summary" | "installing" | "done" | "error";
  step: 0 | 1;
  file: File | null;
  progress: number;
  errors: string[];
  summary: InstallSummary | null;
  installedVersion: number | null;
};

export type InstallEvent =
  | { type: "pick"; file: File }
  | { type: "reject"; error: string }
  | { type: "progress"; pct: number }
  | { type: "uploaded" }
  | { type: "inspected"; summary: InstallSummary }
  | { type: "failed"; errors: string[] }
  | { type: "install" }
  | { type: "installed"; version: number }
  | { type: "reset" };

export const initialInstallState: InstallState = {
  phase: "idle",
  step: 0,
  file: null,
  progress: 0,
  errors: [],
  summary: null,
  installedVersion: null,
};

// Reducteur pur du parcours d'installation : fichier -> recapitulatif -> installation.
export function installReducer(state: InstallState, event: InstallEvent): InstallState {
  switch (event.type) {
    case "pick":
      return { ...initialInstallState, phase: "uploading", file: event.file };
    case "reject":
      return { ...initialInstallState, phase: "error", errors: [event.error] };
    case "progress":
      return { ...state, progress: event.pct };
    case "uploaded":
      return { ...state, phase: "analysing", progress: 100 };
    case "inspected":
      return { ...state, phase: "summary", step: 1, summary: event.summary, errors: [], progress: 0 };
    case "failed":
      // L'etape reste celle de l'etat courant : 0 avant le recapitulatif, 1 apres.
      return { ...state, phase: "error", errors: event.errors };
    case "install":
      return { ...state, phase: "installing", step: 1, progress: 0, errors: [] };
    case "installed":
      return { ...state, phase: "done", installedVersion: event.version };
    case "reset":
      return initialInstallState;
  }
}

export function isBusy(state: InstallState): boolean {
  return state.phase === "uploading" || state.phase === "analysing" || state.phase === "installing";
}

// Message de confirmation a la fermeture : null si rien n'est en cours.
export function closeConfirmation(state: InstallState): string | null {
  if (!isBusy(state)) return null;
  // Envoi termine : le serveur installe et rend l'epreuve, il peut deja avoir fini.
  if (state.phase === "installing" && state.progress >= 100) {
    return "L'installation est peut-être déjà terminée sur le serveur. Fermer quand même ?";
  }
  return "Abandonner l'installation ?";
}

// Apres abandon d'une installation, le catalogue doit etre recharge (etat reel du serveur).
export function shouldRefreshAfterClose(state: InstallState): boolean {
  return state.phase === "installing";
}

