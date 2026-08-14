import { describe, it, expect } from "vitest";
import { resolveSource } from "../resolve-source";
import { SOURCES } from "../sources";
import type { TemplateContext } from "../../types";

const CTX: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    photoDataUrl: "data:image/png;base64,AAA",
    structure: "ACME",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: {
    title: "Salon 2027",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: {
    id: "BDG-1",
    verifyUrl: "https://x/verify/BDG-1",
    qrCodeDataUrl: "data:image/png;base64,BBB",
  },
};

describe("resolveSource", () => {
  it("resout chaque source de la liste blanche sans lever", () => {
    for (const path of Object.keys(SOURCES)) {
      expect(() => resolveSource(CTX, path)).not.toThrow();
    }
  });

  it("resout un texte", () => {
    expect(resolveSource(CTX, "participant.firstName")).toBe("Awa");
    expect(resolveSource(CTX, "participant.lastName")).toBe("Diallo");
    expect(resolveSource(CTX, "participant.structure")).toBe("ACME");
  });

  it("resout une couleur", () => {
    expect(resolveSource(CTX, "category.color")).toBe("#4f46e5");
  });

  it("resout un booleen", () => {
    expect(resolveSource(CTX, "category.anonymous")).toBe(true);
    expect(resolveSource(CTX, "category.neutralBadge")).toBe(false);
  });

  it("formate une date comme les gabarits d'e-mail", () => {
    expect(resolveSource(CTX, "event.date")).toBe("15 décembre 2027");
  });

  it("rend une chaine vide pour un logo absent", () => {
    expect(resolveSource(CTX, "event.logoDataUrl")).toBe("");
  });

  it("resout les champs du badge", () => {
    expect(resolveSource(CTX, "badge.id")).toBe("BDG-1");
    expect(resolveSource(CTX, "badge.verifyUrl")).toBe("https://x/verify/BDG-1");
  });

  it("leve sur un chemin inconnu", () => {
    expect(() => resolveSource(CTX, "participant.secret")).toThrow(/inconnue/i);
  });
});
