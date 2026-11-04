import { describe, expect, it } from "vitest";
import { mergeRows, mergeRowsById } from "../merge-rows";

type Row = { id: string; v: number };

describe("mergeRowsById", () => {
  it("remplace la ligne presente des deux cotes par la version fraiche", () => {
    expect(mergeRowsById<Row>([{ id: "a", v: 1 }], [{ id: "a", v: 2 }])).toEqual([{ id: "a", v: 2 }]);
  });

  it("conserve une ligne absente de la liste fraiche", () => {
    expect(mergeRowsById<Row>([{ id: "a", v: 1 }, { id: "b", v: 1 }], [{ id: "b", v: 9 }])).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 9 },
    ]);
  });

  it("ignore une ligne fraiche absente de la page visible", () => {
    expect(mergeRowsById<Row>([{ id: "a", v: 1 }], [{ id: "a", v: 1 }, { id: "z", v: 5 }])).toEqual([
      { id: "a", v: 1 },
    ]);
  });

  it("conserve l'ordre de la page visible", () => {
    const visible: Row[] = [{ id: "c", v: 0 }, { id: "a", v: 0 }, { id: "b", v: 0 }];
    const fresh: Row[] = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "c", v: 3 }];
    expect(mergeRowsById(visible, fresh).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("mergeRows", () => {
  it("accepte une cle personnalisee", () => {
    expect(mergeRows([{ k: "x", v: 1 }], [{ k: "x", v: 2 }], (r) => r.k)).toEqual([{ k: "x", v: 2 }]);
  });
});
