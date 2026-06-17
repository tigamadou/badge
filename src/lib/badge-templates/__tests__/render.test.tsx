import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { BADGE_TEMPLATES } from "../index";
import type { TemplateContext } from "../types";

// PNG 1x1 transparent base64 -- suffisant pour valider qu'une <Image /> React-PDF
// recoit un input parseable sans toucher au reseau.
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

const fakeCtx: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    photoDataUrl: PNG_1X1,
    structure: "ENSEA",
  },
  category: {
    name: "Visiteur",
    color: "#4f46e5",
    neutralBadge: false,
    anonymous: false,
  },
  event: {
    title: "Salon 2026",
    date: new Date("2026-10-01"),
    location: "Abidjan",
    logoDataUrl: PNG_1X1,
  },
  badge: {
    id: "REG-TEST-001",
    verifyUrl: "https://badge.local/verify/REG-TEST-001",
    qrCodeDataUrl: PNG_1X1,
  },
};

// Compte les Page objects dans un buffer PDF. Un Page object se reconnait par
// "/Type /Page" qui n'est pas suivi d'un "s" (sinon c'est /Pages).
function countPdfPages(buf: Buffer): number {
  const txt = buf.toString("latin1");
  const matches = txt.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

describe("rendu PDF par template", () => {
  for (const [id, tpl] of Object.entries(BADGE_TEMPLATES)) {
    it(`${id} produit un PDF valide avec ${tpl.meta.pages} page(s)`, async () => {
      const Comp = tpl.Component;
      const buf = await renderToBuffer(<Comp ctx={fakeCtx} />);
      expect(buf.length).toBeGreaterThan(0);
      expect(buf.toString("latin1", 0, 5)).toBe("%PDF-");
      expect(countPdfPages(buf)).toBe(tpl.meta.pages);
    }, 30_000);
  }
});
