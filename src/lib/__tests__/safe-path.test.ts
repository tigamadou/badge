import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/safe-path";

describe("safeInternalPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeInternalPath("/e/salon-2026/register")).toBe("/e/salon-2026/register");
  });

  it("accepte un chemin interne avec query", () => {
    expect(safeInternalPath("/account/profile?pending=1")).toBe("/account/profile?pending=1");
  });

  it("refuse une URL absolue", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBeNull();
  });

  it("refuse une URL protocol-relative", () => {
    expect(safeInternalPath("//evil.example/phish")).toBeNull();
  });

  it("refuse un chemin relatif sans slash initial", () => {
    expect(safeInternalPath("account/profile")).toBeNull();
  });

  it("refuse une chaine vide", () => {
    expect(safeInternalPath("")).toBeNull();
  });

  it("refuse null et undefined", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });

  it("refuse un backslash initial (contournement navigateur)", () => {
    expect(safeInternalPath("\\evil.example")).toBeNull();
    expect(safeInternalPath("/\\evil.example")).toBeNull();
  });
});
