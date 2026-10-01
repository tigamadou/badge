import { describe, it, expect } from "vitest";
import {
  publicRegistrationSchema,
  editRegistrationSchema,
  ID_DOC_TYPES,
} from "@/lib/validators/registration";

const valid = {
  email: "a@b.co",
  firstName: "Alice",
  lastName: "Doe",
  structure: "Acme",
  categoryId: "cat1",
  idDocumentType: "CNI",
  idDocumentNumber: "ABC123",
  photoToken: "p.tok",
  idDocumentToken: "d.tok",
  recaptchaToken: "",
};

describe("publicRegistrationSchema", () => {
  it("accepts a valid payload", () => {
    const r = publicRegistrationSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
  it("rejects invalid email", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, email: "no" });
    expect(r.success).toBe(false);
  });
  it("rejects empty firstName", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, firstName: "" });
    expect(r.success).toBe(false);
  });
  it("rejects unknown idDocumentType", () => {
    const r = publicRegistrationSchema.safeParse({ ...valid, idDocumentType: "FOO" });
    expect(r.success).toBe(false);
  });
  it("requires photoToken and idDocumentToken", () => {
    expect(publicRegistrationSchema.safeParse({ ...valid, photoToken: "" }).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...valid, idDocumentToken: "" }).success).toBe(false);
  });
  it("trims and lowercases email", () => {
    const r = publicRegistrationSchema.parse({ ...valid, email: "  A@B.CO " });
    expect(r.email).toBe("a@b.co");
  });
});

describe("editRegistrationSchema", () => {
  it("makes photoToken and idDocumentToken optional", () => {
    const rest = { ...valid } as Partial<typeof valid>;
    delete rest.photoToken;
    delete rest.idDocumentToken;
    expect(editRegistrationSchema.safeParse(rest).success).toBe(true);
  });
});

describe("ID_DOC_TYPES", () => {
  it("exposes the canonical list", () => {
    expect(ID_DOC_TYPES).toContain("CNI");
    expect(ID_DOC_TYPES).toContain("Passeport");
  });
});
