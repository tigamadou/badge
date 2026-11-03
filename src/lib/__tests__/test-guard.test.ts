import { describe, it, expect } from "vitest";
import { assertTestDatabase } from "@/test-guard";

describe("assertTestDatabase", () => {
  it("accepte une base dont le nom finit par _test", () => {
    expect(() => assertTestDatabase("mysql://root:password@mysql:3306/badge_test")).not.toThrow();
    expect(() => assertTestDatabase("mysql://root:password@host.docker.internal:33060/badge_2a_test")).not.toThrow();
  });

  it("refuse une base de dev ou une URL absente", () => {
    expect(() => assertTestDatabase("mysql://root:password@mysql:3306/badge")).toThrow(/badge/);
    expect(() => assertTestDatabase("mysql://root:password@mysql:3306/badge_2a")).toThrow();
    expect(() => assertTestDatabase("mysql://root:password@mysql:3306/badge_test_old")).toThrow();
    expect(() => assertTestDatabase(undefined)).toThrow();
    expect(() => assertTestDatabase("pas-une-url")).toThrow();
  });

  it("n'affiche jamais l'URL, qui peut contenir un mot de passe", () => {
    expect(() => assertTestDatabase("mysql://root:s3cret@mysql:3306/badge")).toThrow(/^(?![\s\S]*s3cret)/);
    expect(() => assertTestDatabase("s3cret-pas-une-url")).toThrow(/^(?![\s\S]*s3cret)/);
  });
});
