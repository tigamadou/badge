import { describe, it, expect } from "vitest";
import { indexVariables, resolveVariable, samplesOf } from "../variables";
import type { VariableDeclaration } from "../manifest-types";

// Litteral UTC ("...Z") : formatDate lit desormais les composantes UTC, donc
// cette chaine reste le 15 decembre dans tout fuseau. Une chaine sans "Z" serait
// interpretee en heure LOCALE par `Date` et deriverait d'un jour a l'est de l'UTC.
const EVENT_DATE_SAMPLE = "2027-12-15T00:00:00.000Z";

const VARS: VariableDeclaration[] = [
  { name: "participant.firstName", kind: "text", label: "Prenom", sample: "Awa" },
  { name: "participant.photo", kind: "image", label: "Photo", sample: "assets/photo.png" },
  { name: "category.anonymous", kind: "boolean", label: "Anonyme", sample: false },
  { name: "category.color", kind: "color", label: "Couleur", sample: "#4f46e5" },
  { name: "event.date", kind: "date", label: "Date", format: "court", sample: EVENT_DATE_SAMPLE },
  { name: "mention", kind: "text", label: "Mention" },
];

const INDEX = indexVariables(VARS);
const ASSETS = (name: string) => `data:image/png;base64,${name}`;

describe("resolveVariable", () => {
  it("rend une valeur texte", () => {
    expect(resolveVariable(INDEX, { "participant.firstName": "Awa" }, "participant.firstName")).toBe("Awa");
  });

  it("formate une date selon le format declare", () => {
    expect(resolveVariable(INDEX, { "event.date": EVENT_DATE_SAMPLE }, "event.date")).toBe("15/12/2027");
  });

  it("retombe sur le vide quand la valeur manque", () => {
    expect(resolveVariable(INDEX, {}, "participant.firstName")).toBe("");
    expect(resolveVariable(INDEX, {}, "event.date")).toBe("");
    expect(resolveVariable(INDEX, {}, "participant.photo")).toBe("");
  });

  it("retombe sur false pour un booleen absent", () => {
    expect(resolveVariable(INDEX, {}, "category.anonymous")).toBe(false);
  });

  it("rend un booleen present", () => {
    expect(resolveVariable(INDEX, { "category.anonymous": true }, "category.anonymous")).toBe(true);
  });

  it("leve sur une variable non declaree", () => {
    // Garde defensive : le schema garantit deja que toute reference est declaree.
    expect(() => resolveVariable(INDEX, {}, "inconnue")).toThrow(/inconnue/);
  });

  it("ignore une date illisible plutot que de casser le rendu", () => {
    expect(resolveVariable(INDEX, { "event.date": "pas une date" }, "event.date")).toBe("");
  });
});

describe("samplesOf", () => {
  it("construit les valeurs d'epreuve depuis les samples", () => {
    const samples = samplesOf(VARS, ASSETS);
    expect(samples["participant.firstName"]).toBe("Awa");
    expect(samples["category.anonymous"]).toBe(false);
    expect(samples["category.color"]).toBe("#4f46e5");
    expect(samples["event.date"]).toBe(EVENT_DATE_SAMPLE);
  });

  it("resout le sample d'une image en data URL du paquet", () => {
    expect(samplesOf(VARS, ASSETS)["participant.photo"]).toBe("data:image/png;base64,assets/photo.png");
  });

  it("laisse vide une variable sans sample", () => {
    expect(samplesOf(VARS, ASSETS)["mention"]).toBe("");
  });
});
