import { describe, it, expect } from "vitest";
import { escapeHtml, formatFromAddress, formatFrenchDate, buildBaseUrl } from "@/lib/mail-helpers";

describe("escapeHtml", () => {
  it("escapes <, >, &, \", '", () => {
    expect(escapeHtml('<script>alert("x&y")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;",
    );
  });
  it("preserves french accents", () => {
    expect(escapeHtml("éèàçîôû")).toBe("éèàçîôû");
  });
  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("escapes single quote", () => {
    expect(escapeHtml("d'Ivoire")).toBe("d&#39;Ivoire");
  });
});

describe("formatFromAddress", () => {
  it("returns smtpFrom as-is when no label", () => {
    expect(formatFromAddress("noreply@badge.local", null)).toBe("noreply@badge.local");
  });
  it("formats with label when label provided", () => {
    expect(formatFromAddress("noreply@x.com", "Org Acme")).toBe('"Org Acme" <noreply@x.com>');
  });
  it("escapes quotes in label", () => {
    expect(formatFromAddress("a@b.com", 'Org "Acme"')).toBe('"Org \\"Acme\\"" <a@b.com>');
  });
  it("returns smtpFrom unchanged when smtpFrom already has format `Name <email>`", () => {
    expect(formatFromAddress("Badge <noreply@badge.local>", null)).toBe(
      "Badge <noreply@badge.local>",
    );
  });
  it("keeps smtpFrom as-is when it already has `Name <email>` even with a label", () => {
    // label present => on depasse l.18 ; smtpFrom contient < et > => branche l.19 vraie.
    expect(formatFromAddress("Badge <noreply@badge.local>", "Org Acme")).toBe(
      "Badge <noreply@badge.local>",
    );
  });
  it("wraps with the label when smtpFrom has `<` but not `>`", () => {
    // includes("<") vrai mais includes(">") faux => operande droit de l.19 evalue a faux.
    expect(formatFromAddress("weird<addr", "Org Acme")).toBe('"Org Acme" <weird<addr>');
  });
});

describe("formatFrenchDate", () => {
  it("formats a date in french long form", () => {
    expect(formatFrenchDate(new Date("2026-05-28T10:00:00Z"))).toMatch(/28 mai 2026/);
  });
});

describe("buildBaseUrl", () => {
  it("uses BASE_URL when defined", () => {
    expect(buildBaseUrl({ BASE_URL: "https://x.example", NEXTAUTH_URL: "" })).toBe(
      "https://x.example",
    );
  });
  it("falls back to NEXTAUTH_URL", () => {
    expect(buildBaseUrl({ BASE_URL: "", NEXTAUTH_URL: "https://n.example" })).toBe(
      "https://n.example",
    );
  });
  it("defaults to http://localhost:3000 when both empty", () => {
    expect(buildBaseUrl({ BASE_URL: "", NEXTAUTH_URL: "" })).toBe("http://localhost:3000");
  });
  it("trims trailing slash", () => {
    expect(buildBaseUrl({ BASE_URL: "https://x/", NEXTAUTH_URL: "" })).toBe("https://x");
  });
});
