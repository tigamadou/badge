import { describe, it, expect } from "vitest";
import { toRegistrationCsv, escapeCsvField } from "@/lib/registration-csv";

describe("escapeCsvField", () => {
  it("returns plain values unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField("amadou@example.com")).toBe("amadou@example.com");
  });

  it("quotes fields with commas", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
  });

  it("quotes fields with newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes inner double quotes by doubling", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("renders null/undefined as empty string", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("toRegistrationCsv", () => {
  it("returns header + rows in canonical order", () => {
    const csv = toRegistrationCsv([
      {
        id: "R1",
        firstName: "Amadou",
        lastName: "Diallo",
        email: "a@x.test",
        structure: "ENSEA",
        categoryName: "VIP",
        status: "APPROVED",
        idDocumentType: "CNI",
        idDocumentNumber: "ABC",
        badgePrinted: true,
        allAccessGranted: false,
        createdAt: new Date("2026-05-01T10:00:00Z"),
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "id,firstName,lastName,email,structure,category,status,idDocumentType,idDocumentNumber,badgePrinted,allAccess,createdAt",
    );
    expect(lines[1]).toContain("R1");
    expect(lines[1]).toContain("Amadou");
    expect(lines[1]).toContain("APPROVED");
    expect(lines[1]).toContain("true");
  });

  it("returns header only on empty input", () => {
    const csv = toRegistrationCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("escapes commas in names", () => {
    const csv = toRegistrationCsv([
      {
        id: "R1",
        firstName: "Jean, Paul",
        lastName: "Doe",
        email: "x@x.test",
        structure: "S",
        categoryName: "Cat",
        status: "PENDING",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        badgePrinted: false,
        allAccessGranted: false,
        createdAt: new Date(),
      },
    ]);
    expect(csv).toContain('"Jean, Paul"');
  });
});
