import { describe, expect, it } from "vitest";
import type { ThreadEntryDTO } from "@/lib/print-requests/thread";
import { afterCursor, attachmentName, entriesUrlAfter, lineChangesOf, mergeEntries, OVERLAP_MS } from "../thread-sync";

const entry = (id: string, createdAt: string, extra: Partial<ThreadEntryDTO> = {}): ThreadEntryDTO => ({
  id, side: "STAFF", kind: "MESSAGE", body: id, eventType: null, details: null,
  attachmentKey: null, internal: false, authorName: null, createdAt, ...extra,
});

describe("mergeEntries", () => {
  it("dédoublonne par id et trie chronologiquement (égalité départagée par id)", () => {
    const a = entry("a", "2026-01-01T10:00:00.000Z");
    const b = entry("b", "2026-01-01T10:00:00.000Z");
    const c = entry("c", "2026-01-01T10:00:05.000Z");
    expect(mergeEntries([c, a], [b, a, c]).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(mergeEntries([b], [a]).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("afterCursor / entriesUrlAfter", () => {
  it("aucune entrée : pas de borne", () => {
    expect(afterCursor([])).toBeNull();
    expect(entriesUrlAfter("/m", [])).toBe("/m");
  });
  it("plus grand createdAt moins le chevauchement", () => {
    const list = [entry("a", "2026-01-01T10:00:10.000Z"), entry("b", "2026-01-01T10:00:00.000Z")];
    expect(afterCursor(list)).toBe(new Date(Date.parse("2026-01-01T10:00:10.000Z") - OVERLAP_MS).toISOString());
    expect(entriesUrlAfter("/m", list)).toBe(`/m?after=${encodeURIComponent("2026-01-01T10:00:08.000Z")}`);
  });
});

describe("lineChangesOf / attachmentName", () => {
  it("ne détaille que LINES_CHANGED", () => {
    expect(lineChangesOf({ eventType: "QUOTE_SENT", details: {} })).toEqual([]);
    expect(lineChangesOf({ eventType: "LINES_CHANGED", details: null })).toEqual([]);
    expect(lineChangesOf({ eventType: "LINES_CHANGED", details: { changes: "x" } })).toEqual([]);
    expect(
      lineChangesOf({ eventType: "LINES_CHANGED", details: { changes: [{ op: "REMOVED", label: "Cordon", lineId: "" }] } }),
    ).toHaveLength(1);
  });
  it("nom de fichier = dernier segment", () => {
    expect(attachmentName("print-requests/e/a.pdf")).toBe("a.pdf");
  });
});
