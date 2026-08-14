import { describe, it, expect } from "vitest";
import { extractPaths, renderTextTemplate } from "../text-template";
import type { TemplateContext } from "../../types";

const CTX = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: {
    title: "Salon",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: { id: "BDG-1", verifyUrl: "u", qrCodeDataUrl: "" },
} as TemplateContext;

describe("extractPaths", () => {
  it("extrait les chemins d'un gabarit", () => {
    expect(extractPaths("{participant.firstName} {participant.lastName}")).toEqual([
      "participant.firstName",
      "participant.lastName",
    ]);
  });

  it("rend une liste vide pour un texte litteral", () => {
    expect(extractPaths("Participant anonyme")).toEqual([]);
  });

  it("ignore une accolade qui n'est pas un chemin", () => {
    expect(extractPaths("{pasunchemin}")).toEqual([]);
  });
});

describe("renderTextTemplate", () => {
  it("remplace plusieurs sources", () => {
    expect(renderTextTemplate("{participant.firstName} {participant.lastName}", CTX)).toBe(
      "Awa Diallo",
    );
  });

  it("conserve les litteraux autour des sources", () => {
    expect(renderTextTemplate("#{badge.id}", CTX)).toBe("#BDG-1");
  });

  it("rend un texte purement litteral tel quel", () => {
    expect(renderTextTemplate("Participant anonyme", CTX)).toBe("Participant anonyme");
  });

  it("formate une date interpolee", () => {
    expect(renderTextTemplate("{event.date}", CTX)).toBe("15 décembre 2027");
  });

  it("preserve les sauts de ligne", () => {
    expect(renderTextTemplate("{event.date}\n{event.location}", CTX)).toBe(
      "15 décembre 2027\nNiamey",
    );
  });
});
