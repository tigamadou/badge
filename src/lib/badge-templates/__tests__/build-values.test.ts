import { describe, expect, it } from "vitest";
import { buildValues } from "../build-values";
import type { TemplateContext } from "../types";
import type { VariableDeclaration } from "@tigamadou/pdf-engine";

const ctx: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    structure: "Organisation",
    photoDataUrl: "data:image/png;base64,AAA",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: {
    title: "Forum",
    date: new Date("2027-12-15T00:00:00.000Z"),
    location: "Cotonou",
    logoDataUrl: null,
    securityInstructions: ["Restez dans la zone."],
  },
  badge: { id: "DEMO-1", verifyUrl: "https://badge.local/verify/DEMO-1", qrCodeDataUrl: "data:image/png;base64,BBB", allAccess: true },
};

const declare = (name: string, kind: VariableDeclaration["kind"]): VariableDeclaration => ({
  name,
  kind,
  label: name,
});

describe("buildValues", () => {
  it("lit chaque variable par sa source", () => {
    const values = buildValues(ctx, [declare("prenom", "text"), declare("couleur", "color")], {
      prenom: "participant.firstName",
      couleur: "category.color",
    });
    expect(values).toEqual({ prenom: "Awa", couleur: "#4f46e5" });
  });

  it("passe une date en ISO, sans la formater", () => {
    // Le format appartient desormais au manifeste : resolveVariable l'applique.
    const values = buildValues(ctx, [declare("dateEvent", "date")], { dateEvent: "event.date" });
    expect(values.dateEvent).toBe("2027-12-15T00:00:00.000Z");
  });

  it("lit les consignes de l'evenement comme une liste", () => {
    const values = buildValues(ctx, [declare("consignes", "list")], { consignes: "event.securityInstructions" });
    expect(values.consignes).toEqual(["Restez dans la zone."]);
  });

  it("garde les booleens tels quels", () => {
    const values = buildValues(ctx, [declare("anonyme", "boolean")], { anonyme: "category.anonymous" });
    expect(values.anonyme).toBe(true);
  });

  it("n'ecrit rien pour une variable laissee vide", () => {
    // Rien d'ecrit => resolveVariable rend le vide du type => isEmpty joue, et les
    // blocs de repli fonctionnent sans code supplementaire.
    const values = buildValues(ctx, [declare("mention", "text")], { mention: null });
    expect(values).toEqual({});
    expect("mention" in values).toBe(false);
  });

  it("n'ecrit rien pour une variable absente de la table", () => {
    expect(buildValues(ctx, [declare("mention", "text")], {})).toEqual({});
  });

  it("rend une chaine vide pour un logo absent", () => {
    const values = buildValues(ctx, [declare("logo", "image")], { logo: "event.logoDataUrl" });
    expect(values.logo).toBe("");
  });

  it("leve sur une source inconnue", () => {
    // Garde defensive : validateBindings a deja refuse ce cas a l'installation.
    expect(() =>
      buildValues(ctx, [declare("x", "text")], { x: "participant.nickname" }),
    ).toThrow('buildValues : source inconnue "participant.nickname"');
  });

  it.each(["constructor", "toString", "valueOf"])(
    "n'ecrit rien pour une variable nommee %s absente de la table",
    (name) => {
      // Sans controle de propriete propre, le prototype fournirait une « source ».
      expect(buildValues(ctx, [declare(name, "text")], {})).toEqual({});
    },
  );

  it("lit normalement une variable nommee constructor quand elle est liee", () => {
    const values = buildValues(ctx, [declare("constructor", "text")], {
      constructor: "participant.firstName",
    });
    expect(Object.hasOwn(values, "constructor")).toBe(true);
    expect(values.constructor).toBe("Awa");
  });

  it("leve sur une source qui n'existe que sur le prototype", () => {
    expect(() => buildValues(ctx, [declare("x", "text")], { x: "toString" })).toThrow(
      'buildValues : source inconnue "toString"',
    );
  });

  it("lit l'All Access de l'inscription", () => {
    const values = buildValues(ctx, [declare("isAllAccess", "boolean")], { isAllAccess: "badge.allAccess" });
    expect(values.isAllAccess).toBe(true);
  });
});
