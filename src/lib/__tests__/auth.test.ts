import { describe, it, expect } from "vitest";
import { checkRole } from "../auth";

describe("checkRole", () => {
  it("SUPER_ADMIN has access to all roles", () => {
    expect(checkRole("SUPER_ADMIN", "OPERATOR")).toBe(true);
    expect(checkRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(checkRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("ADMIN has access to ADMIN, MODERATEUR and OPERATOR", () => {
    expect(checkRole("ADMIN", "OPERATOR")).toBe(true);
    expect(checkRole("ADMIN", "MODERATEUR")).toBe(true);
    expect(checkRole("ADMIN", "ADMIN")).toBe(true);
    expect(checkRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("MODERATEUR has access to MODERATEUR and OPERATOR", () => {
    expect(checkRole("MODERATEUR", "OPERATOR")).toBe(true);
    expect(checkRole("MODERATEUR", "MODERATEUR")).toBe(true);
    expect(checkRole("MODERATEUR", "ADMIN")).toBe(false);
    expect(checkRole("MODERATEUR", "SUPER_ADMIN")).toBe(false);
  });

  it("OPERATOR only has access to OPERATOR", () => {
    expect(checkRole("OPERATOR", "OPERATOR")).toBe(true);
    expect(checkRole("OPERATOR", "MODERATEUR")).toBe(false);
    expect(checkRole("OPERATOR", "ADMIN")).toBe(false);
    expect(checkRole("OPERATOR", "SUPER_ADMIN")).toBe(false);
  });
});
