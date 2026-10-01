import { describe, it, expect } from "vitest";
import {
  MAX_SECURITY_INSTRUCTIONS,
  MAX_SECURITY_INSTRUCTION_CHARS,
  cleanSecurityInstructions,
  linesToInstructions,
  readSecurityInstructions,
} from "../security-instructions";

describe("consignes de securite", () => {
  it("expose les limites du moteur", () => {
    expect(MAX_SECURITY_INSTRUCTIONS).toBe(30);
    expect(MAX_SECURITY_INSTRUCTION_CHARS).toBe(500);
  });

  it("nettoie : trim et lignes vides retirees", () => {
    expect(cleanSecurityInstructions(["  Un ", "", "   ", "Deux"])).toEqual(["Un", "Deux"]);
  });

  it("decoupe une saisie multi-ligne", () => {
    expect(linesToInstructions("Un\r\n\n  Deux  \n")).toEqual(["Un", "Deux"]);
    expect(linesToInstructions("")).toEqual([]);
  });

  it("lit une colonne JSON quelle que soit sa forme", () => {
    expect(readSecurityInstructions(null)).toEqual([]);
    expect(readSecurityInstructions(undefined)).toEqual([]);
    expect(readSecurityInstructions({ a: 1 })).toEqual([]);
    expect(readSecurityInstructions(42)).toEqual([]);
    expect(readSecurityInstructions(["Un", 2, "  ", "Deux"])).toEqual(["Un", "Deux"]);
  });
});
