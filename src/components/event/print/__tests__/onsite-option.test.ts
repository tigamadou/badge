import { describe, it, expect } from "vitest";
import { onsiteOptionState } from "../onsite-option";

describe("onsiteOptionState", () => {
  it("désactivée sans message pendant le chargement", () => {
    expect(onsiteOptionState({ status: "loading" })).toEqual({ disabled: true, showNotice: false });
  });
  it("erreur réseau : option active, pas de message", () => {
    expect(onsiteOptionState({ status: "error" })).toEqual({ disabled: false, showNotice: false });
  });
  it("modèle adapté : option active", () => {
    expect(onsiteOptionState({ status: "ready", eligible: true })).toEqual({ disabled: false, showNotice: false });
  });
  it("modèle inadapté : option désactivée avec message", () => {
    expect(onsiteOptionState({ status: "ready", eligible: false })).toEqual({ disabled: true, showNotice: true });
  });
});
