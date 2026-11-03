// Affectation des badges aux emplacements d'une planche, avec le verso en
// miroir pour l'impression recto-verso. Pur, sans import serveur.
import type { LayoutSpec, Rect, SheetLayout } from "./compute-layout";

export type Rotation = 0 | 90 | 180 | 270;

export type Placement = {
  sheetIndex: number;
  face: "RECTO" | "VERSO";
  badgeIndex: number;
  pageIndex: 0 | 1;
  slot: Rect;
  // Degres anti-horaires, appliques au contenu de la page du badge.
  rotation: Rotation;
};

function normalize(deg: number): Rotation {
  return ((((deg % 360) + 360) % 360) as Rotation);
}

// Numero de page (base 1) dans le PDF : recto puis verso de chaque feuille.
export function pageNumber(
  sheetIndex: number,
  face: "RECTO" | "VERSO",
  duplex: boolean,
): number {
  if (!duplex) return sheetIndex + 1;
  return sheetIndex * 2 + (face === "RECTO" ? 1 : 2);
}

export function planPlacements(
  layout: SheetLayout,
  spec: Pick<LayoutSpec, "sheetOrientation" | "duplexFlip">,
  opts: { badgeCount: number; duplex: boolean },
): { sheetCount: number; placements: Placement[] } {
  const { badgeCount, duplex } = opts;
  const sheetCount = Math.ceil(badgeCount / layout.perSheet);
  const theta = layout.rotated ? 90 : 0;

  // Axe de retournement de la feuille : vertical si on tourne autour du
  // bord long en portrait, ou autour du bord court en paysage.
  const portrait = spec.sheetOrientation === "PORTRAIT";
  const verticalAxis = portrait === (spec.duplexFlip === "LONG_EDGE");
  const versoRotation = normalize(verticalAxis ? -theta : 180 - theta);
  const { width, height } = layout.sheet;

  const placements: Placement[] = [];
  for (let badgeIndex = 0; badgeIndex < badgeCount; badgeIndex++) {
    const sheetIndex = Math.floor(badgeIndex / layout.perSheet);
    const slot = layout.slots[badgeIndex % layout.perSheet];
    placements.push({
      sheetIndex,
      face: "RECTO",
      badgeIndex,
      pageIndex: 0,
      slot,
      rotation: normalize(theta),
    });
    if (duplex) {
      placements.push({
        sheetIndex,
        face: "VERSO",
        badgeIndex,
        pageIndex: 1,
        slot: verticalAxis
          ? { ...slot, x: width - slot.x - slot.width }
          : { ...slot, y: height - slot.y - slot.height },
        rotation: versoRotation,
      });
    }
  }
  return { sheetCount, placements };
}
