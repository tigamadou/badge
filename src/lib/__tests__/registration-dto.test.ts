import { describe, it, expect } from "vitest";
import { toRegistrationListDTO } from "@/lib/registration-dto";

const row = {
  id: "REG-1",
  snapshotFirstName: "Alice",
  snapshotLastName: "Doe",
  snapshotEmail: "alice@test.local",
  snapshotStructure: "ACME",
  status: "PENDING" as const,
  badgePrinted: false,
  allAccessGranted: false,
  createdAt: new Date("2026-08-07T10:00:00.000Z"),
  category: { id: "cat-1", name: "Presse", color: "#112233", number: 3 },
};

describe("toRegistrationListDTO", () => {
  it("aplatit les champs snapshot en champs metier", () => {
    expect(toRegistrationListDTO(row)).toEqual({
      id: "REG-1",
      firstName: "Alice",
      lastName: "Doe",
      email: "alice@test.local",
      structure: "ACME",
      status: "PENDING",
      badgePrinted: false,
      allAccessGranted: false,
      createdAt: new Date("2026-08-07T10:00:00.000Z"),
      category: { id: "cat-1", name: "Presse", color: "#112233", number: 3 },
    });
  });

  it("n'expose aucune cle prefixee snapshot", () => {
    const dto = toRegistrationListDTO(row) as Record<string, unknown>;
    expect(Object.keys(dto).some((k) => k.startsWith("snapshot"))).toBe(false);
  });
});
