import { describe, it, expect } from "vitest";
import { extractVariables, renderTextTemplate } from "../text-template";
import { indexVariables } from "../variables";
import type { VariableDeclaration } from "../manifest-types";

const VARS: VariableDeclaration[] = [
  { name: "participant.firstName", kind: "text", label: "Prenom" },
  { name: "participant.lastName", kind: "text", label: "Nom" },
  { name: "badge.id", kind: "text", label: "Identifiant" },
  { name: "mention", kind: "text", label: "Mention" },
  { name: "facture.lignes.total", kind: "text", label: "Total" },
];
const INDEX = indexVariables(VARS);
const VALUES = {
  "participant.firstName": "Awa",
  "participant.lastName": "Diallo",
  "badge.id": "BDG-1",
  mention: "VIP",
  "facture.lignes.total": "125 000 F",
};

describe("extractVariables", () => {
  it("extrait les references d'un gabarit", () => {
    expect(extractVariables("{participant.firstName} {participant.lastName}")).toEqual([
      "participant.firstName",
      "participant.lastName",
    ]);
  });

  it("accepte un nom plat", () => {
    expect(extractVariables("Mention : {mention}")).toEqual(["mention"]);
  });

  it("accepte un nom a trois segments", () => {
    expect(extractVariables("{facture.lignes.total}")).toEqual(["facture.lignes.total"]);
  });

  it("ne renvoie rien sur un texte litteral", () => {
    expect(extractVariables("Participant anonyme")).toEqual([]);
  });

  it("rejette un nom avec majuscule initiale au premier segment", () => {
    expect(extractVariables("{Participant.Nom}")).toEqual([]);
  });

  it("rejette un nom avec majuscule initiale a un segment posterieur", () => {
    expect(extractVariables("{participant.Nom}")).toEqual([]);
  });
});

describe("renderTextTemplate", () => {
  it("remplace les references et garde les litteraux", () => {
    expect(renderTextTemplate("#{badge.id}", INDEX, VALUES)).toBe("#BDG-1");
    expect(renderTextTemplate("{participant.firstName} {participant.lastName}", INDEX, VALUES)).toBe(
      "Awa Diallo",
    );
  });

  it("remplace un nom plat", () => {
    expect(renderTextTemplate("Mention : {mention}", INDEX, VALUES)).toBe("Mention : VIP");
  });

  it("rend le vide pour une valeur absente", () => {
    expect(renderTextTemplate("[{mention}]", INDEX, {})).toBe("[]");
  });
});
