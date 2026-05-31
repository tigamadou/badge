import { describe, it, expect } from "vitest";
import { assert, SmokeError } from "../smoke-tests";

describe("smoke-tests helpers", () => {
  it("assert ne jette pas quand la condition est vraie", () => {
    expect(() => assert(true, "ok")).not.toThrow();
  });

  it("assert jette SmokeError quand la condition est fausse", () => {
    expect(() => assert(false, "boom")).toThrow(SmokeError);
    try {
      assert(false, "boom");
    } catch (e) {
      expect(e).toBeInstanceOf(SmokeError);
      expect((e as Error).message).toBe("boom");
    }
  });
});
