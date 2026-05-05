// src/lib/__tests__/generate-id.test.ts
import { describe, it, expect } from "vitest";
import { generateId } from "../generate-id";

describe("generateId", () => {
  it("returns a string of 13 characters", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id).toHaveLength(13);
  });

  it("starts with the event type digit", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id[0]).toBe("1");
  });

  it("contains the date encoded as YYMMDD after the event type", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id.substring(1, 7)).toBe("260524");
  });

  it("has a 6-character alphanumeric suffix", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    const suffix = id.substring(7);
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(
      Array.from({ length: 100 }, () =>
        generateId({ eventType: 1, date: "2026-05-24" })
      )
    );
    expect(ids.size).toBe(100);
  });
});
