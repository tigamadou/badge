import { describe, it, expect } from "vitest";
import { isBlockVisible } from "../conditions";
import type { TemplateContext } from "../../types";

const CTX = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: {
    title: "S",
    date: new Date("2027-01-01T00:00:00Z"),
    location: "N",
    logoDataUrl: null,
  },
  badge: { id: "B", verifyUrl: "u", qrCodeDataUrl: "" },
} as TemplateContext;

describe("isBlockVisible", () => {
  it("affiche un bloc sans condition", () => {
    expect(isBlockVisible(CTX, undefined)).toBe(true);
  });

  it("affiche quand la condition est satisfaite", () => {
    expect(isBlockVisible(CTX, { path: "category.anonymous", equals: true })).toBe(true);
  });

  it("masque quand la condition ne l'est pas", () => {
    expect(isBlockVisible(CTX, { path: "category.anonymous", equals: false })).toBe(false);
  });

  it("fonctionne sur le second chemin autorise", () => {
    expect(isBlockVisible(CTX, { path: "category.neutralBadge", equals: false })).toBe(true);
    expect(isBlockVisible(CTX, { path: "category.neutralBadge", equals: true })).toBe(false);
  });

  it("detecte une valeur absente avec isEmpty", () => {
    // photoDataUrl vaut "" dans ce contexte : le bloc de repli doit s'afficher.
    expect(isBlockVisible(CTX, { path: "participant.photoDataUrl", isEmpty: true })).toBe(true);
    expect(isBlockVisible(CTX, { path: "participant.photoDataUrl", isEmpty: false })).toBe(false);
  });

  it("detecte une valeur presente avec isEmpty", () => {
    const withPhoto = {
      ...CTX,
      participant: { ...CTX.participant, photoDataUrl: "data:image/png;base64,AAA" },
    } as TemplateContext;
    expect(isBlockVisible(withPhoto, { path: "participant.photoDataUrl", isEmpty: false })).toBe(true);
    expect(isBlockVisible(withPhoto, { path: "participant.photoDataUrl", isEmpty: true })).toBe(false);
  });
});
