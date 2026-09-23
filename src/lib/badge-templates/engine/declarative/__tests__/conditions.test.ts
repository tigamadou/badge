import { describe, it, expect } from "vitest";
import { indexConditions, isBlockVisible } from "../conditions";
import { indexVariables } from "../variables";
import type { VariableDeclaration } from "../manifest-types";

const VARS: VariableDeclaration[] = [
  { name: "category.anonymous", kind: "boolean", label: "Anonyme" },
  { name: "category.neutralBadge", kind: "boolean", label: "Neutre" },
  { name: "participant.photo", kind: "image", label: "Photo" },
];
const INDEX = indexVariables(VARS);
const VALUES = { "category.anonymous": true, "category.neutralBadge": false, "participant.photo": "" };

describe("isBlockVisible", () => {
  it("affiche un bloc sans condition", () => {
    expect(isBlockVisible(INDEX, VALUES, undefined)).toBe(true);
  });

  it("affiche quand la condition est satisfaite", () => {
    expect(isBlockVisible(INDEX, VALUES, { variable: "category.anonymous", equals: true })).toBe(true);
  });

  it("masque quand la condition ne l'est pas", () => {
    expect(isBlockVisible(INDEX, VALUES, { variable: "category.anonymous", equals: false })).toBe(false);
  });

  it("evalue un second booleen", () => {
    expect(isBlockVisible(INDEX, VALUES, { variable: "category.neutralBadge", equals: false })).toBe(true);
    expect(isBlockVisible(INDEX, VALUES, { variable: "category.neutralBadge", equals: true })).toBe(false);
  });

  it("detecte une valeur absente avec isEmpty", () => {
    expect(isBlockVisible(INDEX, VALUES, { variable: "participant.photo", isEmpty: true })).toBe(true);
    expect(isBlockVisible(INDEX, VALUES, { variable: "participant.photo", isEmpty: false })).toBe(false);
  });

  it("detecte une valeur presente avec isEmpty", () => {
    const withPhoto = { ...VALUES, "participant.photo": "data:image/png;base64,AAA" };
    expect(isBlockVisible(INDEX, withPhoto, { variable: "participant.photo", isEmpty: false })).toBe(true);
    expect(isBlockVisible(INDEX, withPhoto, { variable: "participant.photo", isEmpty: true })).toBe(false);
  });

  it("exige que TOUTES les conditions d'une liste soient vraies", () => {
    const conditions = [
      { variable: "category.anonymous", equals: true },
      { variable: "participant.photo", isEmpty: true },
    ] as const;
    expect(isBlockVisible(INDEX, VALUES, [...conditions])).toBe(true);
    const withPhoto = { ...VALUES, "participant.photo": "data:image/png;base64,AAA" };
    expect(isBlockVisible(INDEX, withPhoto, [...conditions])).toBe(false);
  });

  it("traite une valeur absente comme vide", () => {
    expect(isBlockVisible(INDEX, {}, { variable: "participant.photo", isEmpty: true })).toBe(true);
    expect(isBlockVisible(INDEX, {}, { variable: "category.anonymous", equals: false })).toBe(true);
  });
});

describe("conditions nommees", () => {
  const CONDITIONS = indexConditions([
    { name: "estAnonyme", when: { variable: "category.anonymous", equals: true } },
    {
      name: "anonymeAvecPhoto",
      when: [
        { variable: "category.anonymous", equals: true },
        { variable: "participant.photo", isEmpty: false },
      ],
    },
  ]);

  it("resout une reference vers une condition nommee", () => {
    expect(isBlockVisible(INDEX, VALUES, { use: "estAnonyme" }, CONDITIONS)).toBe(true);
  });

  it("resout une reference vers une conjonction nommee", () => {
    // Premier membre VRAI, second faux : sans cela le `.every` court-circuiterait
    // au premier et le second ne serait jamais evalue.
    expect(isBlockVisible(INDEX, VALUES, { use: "anonymeAvecPhoto" }, CONDITIONS)).toBe(false);
    // Les deux membres vrais : la conjonction entiere passe.
    const withPhoto = { ...VALUES, "participant.photo": "data:image/png;base64,AAA" };
    expect(isBlockVisible(INDEX, withPhoto, { use: "anonymeAvecPhoto" }, CONDITIONS)).toBe(true);
  });

  it("melange reference et condition litterale dans une liste", () => {
    const visibleIf = [
      { use: "estAnonyme" },
      { variable: "category.neutralBadge", equals: false },
    ];
    expect(isBlockVisible(INDEX, VALUES, visibleIf, CONDITIONS)).toBe(true);
  });

  it("masque le bloc quand la reference est inconnue", () => {
    // Le schema refuse deja ce cas : le moteur se contente de ne pas afficher,
    // plutot que de lever au milieu d'un rendu.
    expect(isBlockVisible(INDEX, VALUES, { use: "jamaisDeclaree" }, CONDITIONS)).toBe(false);
  });

  it("reste compatible avec un appel sans index de conditions", () => {
    expect(isBlockVisible(INDEX, VALUES, { variable: "category.anonymous", equals: true })).toBe(true);
  });
});
