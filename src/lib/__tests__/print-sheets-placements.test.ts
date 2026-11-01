import { describe, expect, it } from "vitest";
import type { LayoutSpec, SheetLayout } from "@/lib/print-sheets/compute-layout";
import { pageNumber, planPlacements } from "@/lib/print-sheets/placements";

function grid(
  sheet: { width: number; height: number },
  rotated: boolean,
  slotW: number,
  slotH: number,
  columns: number,
  rows: number,
): SheetLayout {
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      slots.push({ x: 17.5 + c * (slotW + 5), y: 25 + r * (slotH + 5), width: slotW, height: slotH });
    }
  }
  return {
    sheet,
    rotated,
    columns,
    rows,
    perSheet: columns * rows,
    slots,
    cropMarks: [],
    warnings: [],
  };
}

const portraitLayout = grid({ width: 297, height: 420 }, false, 84, 120, 3, 3);
const portrait: Pick<LayoutSpec, "sheetOrientation" | "duplexFlip"> = {
  sheetOrientation: "PORTRAIT",
  duplexFlip: "LONG_EDGE",
};

describe("planPlacements", () => {
  it("sans recto-verso : 3 feuilles, la derniere avec 2 badges", () => {
    const r = planPlacements(portraitLayout, portrait, { badgeCount: 20, duplex: false });
    expect(r.sheetCount).toBe(3);
    expect(r.placements).toHaveLength(20);
    expect(r.placements.every((p) => p.face === "RECTO" && p.pageIndex === 0 && p.rotation === 0)).toBe(true);
    expect(r.placements.filter((p) => p.sheetIndex === 2)).toHaveLength(2);
  });

  it("portrait LONG_EDGE : verso en miroir gauche-droite, rotation 0", () => {
    const r = planPlacements(portraitLayout, portrait, { badgeCount: 1, duplex: true });
    const [recto, verso] = r.placements;
    expect(recto.slot.x).toBe(17.5);
    expect(verso.face).toBe("VERSO");
    expect(verso.pageIndex).toBe(1);
    expect(verso.slot.x).toBeCloseTo(195.5, 2);
    expect(verso.slot.y).toBe(recto.slot.y);
    expect(verso.rotation).toBe(0);
  });

  it("portrait SHORT_EDGE : verso en miroir haut-bas, rotation 180", () => {
    const r = planPlacements(portraitLayout, { ...portrait, duplexFlip: "SHORT_EDGE" }, { badgeCount: 1, duplex: true });
    const [recto, verso] = r.placements;
    expect(recto.slot.y).toBe(25);
    expect(verso.slot.y).toBeCloseTo(275, 2);
    expect(verso.slot.x).toBe(recto.slot.x);
    expect(verso.rotation).toBe(180);
  });

  it("badges pivotes, portrait LONG_EDGE : recto 90, verso 270", () => {
    const layout = grid({ width: 297, height: 420 }, true, 120, 84, 2, 4);
    const r = planPlacements(layout, portrait, { badgeCount: 1, duplex: true });
    expect(r.placements[0].rotation).toBe(90);
    expect(r.placements[1].rotation).toBe(270);
  });

  it("paysage LONG_EDGE : symetrie horizontale, rotation 180 - theta", () => {
    const layout = grid({ width: 420, height: 297 }, false, 84, 120, 3, 2);
    const spec = { sheetOrientation: "LANDSCAPE" as const, duplexFlip: "LONG_EDGE" as const };
    const [recto, verso] = planPlacements(layout, spec, { badgeCount: 1, duplex: true }).placements;
    expect(verso.slot.x).toBe(recto.slot.x);
    expect(verso.slot.y).toBeCloseTo(297 - 25 - 120, 2);
    expect(verso.rotation).toBe(180);
    const rotated = grid({ width: 420, height: 297 }, true, 120, 84, 3, 2);
    const v2 = planPlacements(rotated, spec, { badgeCount: 1, duplex: true }).placements[1];
    expect(v2.rotation).toBe(90);
  });

  it("derniere feuille partielle : versos aux miroirs des rectos presents", () => {
    const r = planPlacements(portraitLayout, portrait, { badgeCount: 11, duplex: true });
    expect(r.sheetCount).toBe(2);
    const last = r.placements.filter((p) => p.sheetIndex === 1);
    expect(last.map((p) => `${p.badgeIndex}${p.face}`)).toEqual(["9RECTO", "9VERSO", "10RECTO", "10VERSO"]);
    expect(last[1].slot.x).toBeCloseTo(297 - portraitLayout.slots[0].x - 84, 2);
    expect(last[3].slot.x).toBeCloseTo(297 - portraitLayout.slots[1].x - 84, 2);
  });

  it("superposition : S(verso) = recto pour les 8 combinaisons", () => {
    for (const orientation of ["PORTRAIT", "LANDSCAPE"] as const) {
      for (const flip of ["LONG_EDGE", "SHORT_EDGE"] as const) {
        for (const rotated of [false, true]) {
          const sheet = orientation === "PORTRAIT" ? { width: 297, height: 420 } : { width: 420, height: 297 };
          const layout = grid(sheet, rotated, rotated ? 120 : 84, rotated ? 84 : 120, 2, 2);
          const spec = { sheetOrientation: orientation, duplexFlip: flip };
          const ps = planPlacements(layout, spec, { badgeCount: 4, duplex: true }).placements;
          const vertical = (orientation === "PORTRAIT") === (flip === "LONG_EDGE");
          for (let i = 0; i < ps.length; i += 2) {
            const [recto, verso] = [ps[i], ps[i + 1]];
            const back = vertical
              ? { ...verso.slot, x: sheet.width - verso.slot.x - verso.slot.width }
              : { ...verso.slot, y: sheet.height - verso.slot.y - verso.slot.height };
            expect(back.x).toBeCloseTo(recto.slot.x, 2);
            expect(back.y).toBeCloseTo(recto.slot.y, 2);
            // Composition des symetries : rotation du verso + rotation du recto.
            const sum = (recto.rotation + verso.rotation) % 360;
            expect(sum).toBe(vertical ? 0 : 180);
          }
        }
      }
    }
  });
});

describe("pageNumber", () => {
  it("feuille 2 verso = page 4 en recto-verso", () => {
    expect(pageNumber(1, "VERSO", true)).toBe(4);
    expect(pageNumber(1, "RECTO", true)).toBe(3);
  });
  it("une page par feuille sans recto-verso", () => {
    expect(pageNumber(2, "RECTO", false)).toBe(3);
  });
});
