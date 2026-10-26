import { describe, it, expect } from "vitest";
import { parseEmailPayload } from "@/lib/jobs/email-payload";

const base = { to: "a@x.test", subject: "S", html: "<p>H</p>", kind: "k" };

describe("parseEmailPayload", () => {
  it("parses a complete payload", () => {
    expect(parseEmailPayload(base)).toEqual(base);
    expect(parseEmailPayload({ ...base, ctx: { eventId: "e1" }, replyTo: "r@x.test" })).toEqual({
      ...base,
      ctx: { eventId: "e1" },
      replyTo: "r@x.test",
    });
  });

  it.each([null, "x", [], 42])("returns null for a non-object (%j)", (v) =>
    expect(parseEmailPayload(v)).toBeNull());

  it.each(["to", "subject", "html"])("returns null when %s is missing or not a string", (key) => {
    const { [key]: _omit, ...without } = base as Record<string, string>;
    void _omit;
    expect(parseEmailPayload(without)).toBeNull();
    expect(parseEmailPayload({ ...base, [key]: 3 })).toBeNull();
  });

  it("accepts an empty html (purged payload)", () =>
    expect(parseEmailPayload({ ...base, html: "" })).toEqual({ ...base, html: "" }));

  it("drops a ctx that is not an object", () =>
    expect(parseEmailPayload({ ...base, ctx: "x" })).not.toHaveProperty("ctx"));

  it("defaults a missing kind to an empty string", () => {
    const { kind: _k, ...noKind } = base;
    void _k;
    expect(parseEmailPayload(noKind)?.kind).toBe("");
  });
});
