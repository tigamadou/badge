import { describe, it, expect } from "vitest";
import { closeConfirmation, initialInstallState, installReducer, isBusy, shouldRefreshAfterClose } from "../install-machine";

const file = { name: "a.zip", size: 10 } as File;
const summary = { family: "f", label: "F", pages: 1, nextVersion: 1, preview: null, contractVariables: [], options: [] };

describe("installReducer", () => {
  it("fichier -> envoi -> analyse -> recapitulatif", () => {
    let s = installReducer(initialInstallState, { type: "pick", file });
    expect(s).toMatchObject({ phase: "uploading", step: 0, file, progress: 0 });
    s = installReducer(s, { type: "progress", pct: 60 });
    expect(s.progress).toBe(60);
    s = installReducer(s, { type: "uploaded" });
    expect(s.phase).toBe("analysing");
    s = installReducer(s, { type: "inspected", summary });
    expect(s).toMatchObject({ phase: "summary", step: 1, summary, errors: [] });
  });

  it("refus local : erreur a l'etape fichier, sans envoi", () => {
    const s = installReducer(initialInstallState, { type: "reject", error: "trop lourd" });
    expect(s).toMatchObject({ phase: "error", step: 0, errors: ["trop lourd"] });
  });

  it("echec d'analyse : erreurs a l'etape fichier", () => {
    const s = installReducer(installReducer(initialInstallState, { type: "pick", file }), { type: "failed", errors: ["x"] });
    expect(s).toMatchObject({ phase: "error", step: 0, errors: ["x"] });
  });

  it("installation puis succes", () => {
    let s = installReducer(installReducer(installReducer(initialInstallState, { type: "pick", file }), { type: "uploaded" }), { type: "inspected", summary });
    s = installReducer(s, { type: "install" });
    expect(s).toMatchObject({ phase: "installing", step: 1, progress: 0 });
    s = installReducer(s, { type: "installed", version: 4 });
    expect(s).toMatchObject({ phase: "done", installedVersion: 4 });
  });

  it("echec d'installation : reste a l'etape recapitulatif, fichier conserve", () => {
    let s = installReducer(installReducer(installReducer(initialInstallState, { type: "pick", file }), { type: "uploaded" }), { type: "inspected", summary });
    s = installReducer(installReducer(s, { type: "install" }), { type: "failed", errors: ["rendu"] });
    expect(s).toMatchObject({ phase: "error", step: 1, file, summary, errors: ["rendu"] });
  });

  it("pick depuis le recapitulatif ou une erreur d'installation revient a l'etape fichier", () => {
    let s = installReducer(installReducer(installReducer(initialInstallState, { type: "pick", file }), { type: "uploaded" }), { type: "inspected", summary });
    s = installReducer(installReducer(s, { type: "install" }), { type: "failed", errors: ["rendu"] });
    const other = { name: "b.zip", size: 5 } as File;
    s = installReducer(s, { type: "pick", file: other });
    expect(s).toMatchObject({ phase: "uploading", step: 0, file: other, summary: null, installedVersion: null, errors: [], progress: 0 });
  });

  it("reset revient a l'etat initial ; isBusy", () => {
    const s = installReducer(initialInstallState, { type: "pick", file });
    expect(isBusy(s)).toBe(true);
    expect(installReducer(s, { type: "reset" })).toEqual(initialInstallState);
    expect(isBusy(initialInstallState)).toBe(false);
  });
});

describe("abandon de la modale", () => {
  const toSummary = () =>
    installReducer(installReducer(installReducer(initialInstallState, { type: "pick", file }), { type: "uploaded" }), { type: "inspected", summary });

  it("closeConfirmation : rien en cours -> null", () => {
    expect(closeConfirmation(initialInstallState)).toBeNull();
    expect(closeConfirmation(toSummary())).toBeNull();
  });

  it("closeConfirmation : envoi ou analyse -> Abandonner l'installation ?", () => {
    const up = installReducer(initialInstallState, { type: "pick", file });
    expect(closeConfirmation(up)).toBe("Abandonner l'installation ?");
    expect(closeConfirmation(installReducer(up, { type: "uploaded" }))).toBe("Abandonner l'installation ?");
  });

  it("closeConfirmation : installation en envoi -> Abandonner ; phase serveur (100) -> message serveur", () => {
    const inst = installReducer(toSummary(), { type: "install" });
    expect(closeConfirmation(inst)).toBe("Abandonner l'installation ?");
    expect(closeConfirmation(installReducer(inst, { type: "progress", pct: 99 }))).toBe("Abandonner l'installation ?");
    expect(closeConfirmation(installReducer(inst, { type: "progress", pct: 100 }))).toBe(
      "L'installation est peut-être déjà terminée sur le serveur. Fermer quand même ?",
    );
  });

  it("shouldRefreshAfterClose : vrai seulement en phase installing", () => {
    const inst = installReducer(toSummary(), { type: "install" });
    expect(shouldRefreshAfterClose(inst)).toBe(true);
    expect(shouldRefreshAfterClose(installReducer(inst, { type: "progress", pct: 100 }))).toBe(true);
    expect(shouldRefreshAfterClose(toSummary())).toBe(false);
    expect(shouldRefreshAfterClose(initialInstallState)).toBe(false);
    expect(shouldRefreshAfterClose(installReducer(initialInstallState, { type: "pick", file }))).toBe(false);
  });
});
