import { describe, it, expect } from "vitest";
import { EMAIL_KIND } from "@/lib/jobs/enqueue-email";
import { SENSITIVE_EMAIL_KINDS, isSensitiveEmailKind } from "@/lib/jobs/email-kinds";

describe("email kinds", () => {
  it("flags every security kind as sensitive", () => {
    for (const k of SENSITIVE_EMAIL_KINDS) expect(isSensitiveEmailKind(k)).toBe(true);
    expect(SENSITIVE_EMAIL_KINDS).toHaveLength(4);
  });

  it("does not flag a business kind", () =>
    expect(isSensitiveEmailKind(EMAIL_KIND.REGISTRATION_APPROVED)).toBe(false));
});
