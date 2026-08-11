import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
import { parseManifest } from "../schema";
import DefaultV1Template from "../../default-v1/template";
import RectoVersoV1Template from "../../recto-verso-v1/template";
import defaultManifest from "../__fixtures__/default.json";
import rectoVersoManifest from "../__fixtures__/recto-verso.json";
import type { TemplateContext } from "../../types";
import type { TemplateManifest } from "../manifest-types";

const BASE: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    photoDataUrl: "data:image/png;base64,AAA",
    structure: "ACME",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: {
    title: "Salon 2027",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: {
    id: "BDG-1",
    verifyUrl: "https://x/v/BDG-1",
    qrCodeDataUrl: "data:image/png;base64,BBB",
  },
};

const CASES: Array<[string, TemplateContext]> = [
  ["nominal", BASE],
  ["anonyme", { ...BASE, category: { ...BASE.category, anonymous: true } }],
  ["neutre", { ...BASE, category: { ...BASE.category, neutralBadge: true } }],
  ["sans photo", { ...BASE, participant: { ...BASE.participant, photoDataUrl: "" } }],
  [
    "texte long",
    {
      ...BASE,
      participant: {
        ...BASE.participant,
        firstName: "Aminata-Bintou".repeat(3),
        structure: "Association ".repeat(4),
      },
    },
  ],
  ["sans logo d'evenement", { ...BASE, event: { ...BASE.event, logoDataUrl: null } }],
  [
    "avec logo d'evenement",
    { ...BASE, event: { ...BASE.event, logoDataUrl: "data:image/png;base64,LOGO" } },
  ],
];

type Legacy = typeof DefaultV1Template;

const FAMILIES: Array<[string, unknown, Legacy]> = [
  ["default", defaultManifest, DefaultV1Template],
  ["recto-verso", rectoVersoManifest, RectoVersoV1Template],
];

// La comparaison porte sur le CONTENU rendu et la typographie, pas sur le placement :
// un layout flexbox et un layout absolu atteignent le meme resultat par des moyens
// differents. Le placement se verifie visuellement (cf. helpers/render-to-json).
describe("fidelite du moteur declaratif", () => {
  for (const [family, manifest] of FAMILIES) {
    it(`le manifeste de reference ${family} est valide`, () => {
      const res = parseManifest(manifest, []);
      expect(res.ok, res.ok === false ? res.errors.join(" | ") : "").toBe(true);
    });
  }

  for (const [family, manifest, LegacyTemplate] of FAMILIES) {
    for (const [caseName, ctx] of CASES) {
      it(`${family} — ${caseName} : meme contenu rendu que le template historique`, () => {
        const declarative = buildDeclarativeTemplate(
          manifest as TemplateManifest,
          () => "",
          family,
        );
        expect(renderToJson(declarative.Component, ctx)).toEqual(
          renderToJson(LegacyTemplate, ctx),
        );
      });
    }
  }
});
