import { describe, it, expect } from "vitest";
import * as tree from "../public/ui/blocks-tree.js";

type Block = Record<string, unknown>;

const rect = (x: number, y: number, extra: Block = {}): Block => ({
  type: "rect",
  page: 1,
  x,
  y,
  w: 40,
  h: 20,
  fill: "#112233",
  ...extra,
});

describe("blocks-tree", () => {
  it("lit, remplace et supprime par chemin, sans muter l'original", () => {
    const blocks = [
      rect(0, 0),
      { type: "group", page: 1, x: 10, y: 10, w: 100, h: 50, blocks: [rect(5, 5)] },
    ];
    expect(tree.getAt(blocks, [1, 0]).x).toBe(5);
    const replaced = tree.setAt(blocks, [1, 0], rect(9, 9));
    expect(tree.getAt(replaced, [1, 0]).x).toBe(9);
    expect(tree.getAt(blocks, [1, 0]).x).toBe(5);
    expect(tree.removeAt(blocks, [0])).toHaveLength(1);
  });

  it("insere apres un chemin et deplace parmi les freres", () => {
    const blocks = [rect(0, 0), rect(10, 10)];
    expect(tree.insertAfter(blocks, [0], rect(5, 5))[1].x).toBe(5);
    expect(tree.moveWithin(blocks, [1], -1)[0].x).toBe(10);
    // Un deplacement hors bornes laisse l'arbre inchange.
    expect(tree.moveWithin(blocks, [0], -1)).toEqual(blocks);
  });

  it("groupe des freres racine : cadre englobant et coordonnees relatives exactes", () => {
    const blocks = [rect(10, 20), rect(60, 40), rect(200, 200)];
    const res = tree.groupSiblings(blocks, [], [0, 1]);
    expect(res.ok).toBe(true);
    const group = res.blocks[0];
    expect(group).toMatchObject({ type: "group", page: 1, x: 10, y: 20, w: 90, h: 40 });
    expect(group.blocks[0]).toMatchObject({ x: 0, y: 0 });
    expect(group.blocks[1]).toMatchObject({ x: 50, y: 20 });
    expect(group.blocks[0].page).toBeUndefined();
    expect(res.blocks).toHaveLength(2); // le groupe + le rect(200,200)
  });

  it("refuse de grouper moins de deux blocs", () => {
    expect(tree.groupSiblings([rect(0, 0)], [], [0]).ok).toBe(false);
  });

  it("refuse de grouper des blocs racine de pages differentes", () => {
    const res = tree.groupSiblings([rect(0, 0), rect(0, 0, { page: 2 })], [], [0, 1]);
    expect(res.ok).toBe(false);
  });

  it("degrouper restitue l'etat initial au pixel", () => {
    const blocks = [rect(10, 20), rect(60, 40)];
    const grouped = tree.groupSiblings(blocks, [], [0, 1]).blocks;
    const back = tree.ungroupAt(grouped, [0]);
    expect(back.ok).toBe(true);
    expect(back.blocks).toEqual(blocks);
  });

  it("refuse de degrouper un groupe porteur d'effets", () => {
    const grouped = tree.groupSiblings([rect(0, 0), rect(10, 10)], [], [0, 1]).blocks;
    for (const effect of [{ rotate: 45 }, { opacity: 0.5 }, { visibleIf: { path: "x" } }]) {
      const withEffect = tree.setAt(grouped, [0], { ...grouped[0], ...effect });
      expect(tree.ungroupAt(withEffect, [0]).ok).toBe(false);
    }
  });

  it("refuse de degrouper un bloc qui n'est pas un groupe", () => {
    expect(tree.ungroupAt([rect(0, 0)], [0]).ok).toBe(false);
  });

  it("groupe des freres a l'interieur d'un groupe existant", () => {
    const blocks = [
      { type: "group", page: 1, x: 0, y: 0, w: 200, h: 100, blocks: [rect(10, 10), rect(50, 30)] },
    ];
    const res = tree.groupSiblings(blocks, [0], [0, 1]);
    expect(res.ok).toBe(true);
    const inner = res.blocks[0].blocks[0];
    expect(inner).toMatchObject({ type: "group", x: 10, y: 10 });
    expect(inner.page).toBeUndefined();
    expect(inner.blocks[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("aplati l'arbre avec les chemins", () => {
    const blocks = [
      rect(0, 0),
      { type: "group", page: 1, x: 0, y: 0, w: 10, h: 10, blocks: [rect(1, 1)] },
    ];
    expect(tree.flatten(blocks).map((entry) => entry.path)).toEqual([[0], [1], [1, 0]]);
  });
});
