import { describe, it, expect } from "vitest";
import { generateId } from "../generate-id";

describe("generateId", () => {
  const baseOptions = {
    categoryNumber: 1,
    date: "2026-05-24",
    sequentialNumber: 100,
  };

  it("starts with the category number", () => {
    const id = generateId(baseOptions);
    expect(id[0]).toBe("1");
  });

  it("contains the date encoded as YYMMDD at positions 1-6", () => {
    const id = generateId(baseOptions);
    expect(id.substring(1, 7)).toBe("260524");
  });

  it("has 2 random digits at positions 7-8", () => {
    const id = generateId(baseOptions);
    const spacer = id.substring(7, 9);
    expect(spacer).toMatch(/^\d{2}$/);
  });

  it("repeats the category number at position 9", () => {
    const id = generateId(baseOptions);
    expect(id[9]).toBe("1");
  });

  it("ends with the sequential number formatted as 3 digits", () => {
    const id = generateId(baseOptions);
    expect(id.substring(10)).toBe("100");
  });

  it("returns a string of 13 characters", () => {
    const id = generateId(baseOptions);
    expect(id).toHaveLength(13);
  });

  it("pads sequential number to 3 digits", () => {
    const id = generateId({ ...baseOptions, sequentialNumber: 1 });
    expect(id.substring(10)).toBe("001");
  });

  it("works with different category numbers", () => {
    const id = generateId({ ...baseOptions, categoryNumber: 5 });
    expect(id[0]).toBe("5");
    expect(id[9]).toBe("5");
  });

  it("has different random spacers on successive calls", () => {
    const spacers = new Set(
      Array.from({ length: 20 }, () => {
        const id = generateId(baseOptions);
        return id.substring(7, 9);
      })
    );
    // With 20 calls and 100 possible values, very likely to have at least 2 different
    expect(spacers.size).toBeGreaterThan(1);
  });
});
