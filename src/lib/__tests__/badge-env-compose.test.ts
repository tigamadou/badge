import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

const EXPECTED: Record<string, string> = {
  "docker-compose.yml": "prod",
  "docker-compose.dev.yml": "dev",
  "docker-compose.preprod.yml": "preprod",
};

describe.each(Object.entries(EXPECTED))("BADGE_ENV dans %s", (file, expected) => {
  const values = [...readFileSync(path.join(ROOT, file), "utf8").matchAll(/^\s*BADGE_ENV:\s*(\S+)\s*$/gm)].map(
    (match) => match[1],
  );

  it("est posée", () => {
    expect(values.length).toBeGreaterThan(0);
  });

  it(`ne vaut que "${expected}"`, () => {
    expect(new Set(values)).toEqual(new Set([expected]));
  });
});
