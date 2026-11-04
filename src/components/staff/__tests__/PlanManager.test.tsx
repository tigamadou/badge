import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PlanManager, parseFeatures, publicSheetPayload, type PlanRow } from "../PlanManager";

const plan: PlanRow = {
  id: "p1",
  name: "Pro",
  period: "MONTHLY",
  maxEvents: 10,
  maxParticipantsPerEvent: null,
  price: 15000,
  archived: false,
  subscriptionsCount: 2,
  publicVisible: true,
  position: 20,
  description: "Pour les équipes",
  features: ["A", "B"],
  highlighted: true,
};

describe("parseFeatures", () => {
  it("une fonctionnalité par ligne, lignes vides ignorées, espaces retirés", () => {
    expect(parseFeatures("  A \n\n B\n   \nC")).toEqual(["A", "B", "C"]);
    expect(parseFeatures("")).toEqual([]);
  });
});

describe("publicSheetPayload", () => {
  it("convertit la fiche en corps d'API", () => {
    expect(
      publicSheetPayload({ publicVisible: true, highlighted: false, position: "30", description: " Court ", featuresText: "A\nB" }),
    ).toEqual({ publicVisible: true, highlighted: false, position: 30, description: "Court", features: ["A", "B"] });
  });

  it("description vide et liste vide deviennent null, position vide = 0", () => {
    expect(
      publicSheetPayload({ publicVisible: false, highlighted: false, position: " ", description: "  ", featuresText: "\n" }),
    ).toEqual({ publicVisible: false, highlighted: false, position: 0, description: null, features: null });
  });
});

describe("PlanManager", () => {
  const html = renderToStaticMarkup(<PlanManager plans={[plan, { ...plan, id: "p2", name: "Libre", publicVisible: false, highlighted: false }]} />);

  it("création : bouton Nouveau plan, formulaire dans une modale fermée par défaut", () => {
    expect(html).toContain("Nouveau plan");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Fonctionnalités (une par ligne, 12 max)");
  });

  it("tableau : colonne Public avec visibilité, position et mise en avant", () => {
    expect(html).toContain("<th");
    expect(html).toContain("Public");
    expect(html).toContain("Visible · position 20 · mis en avant");
    expect(html).toContain("Masqué · position 20");
    expect(html).toContain("Fiche publique");
  });

  it("aucun plan", () => {
    expect(renderToStaticMarkup(<PlanManager plans={[]} />)).toContain("Aucun plan.");
  });
});
