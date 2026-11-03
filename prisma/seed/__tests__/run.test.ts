import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { BadgeEnvError } from "@/lib/badge-env";
import * as minimal from "../minimal";
import * as demo from "../demo";
import { runSeed } from "../run";

describe("runSeed", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it.each([
    ["prod", { BADGE_ENV: "prod" }],
    ["vide", {}],
  ])("mode demo refuse avant toute ecriture, seed minimal compris (%s)", async (_label, env) => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({ data: { id: "singleton", smtpHost: "smtp.reel.example" } });
    const minimalSpy = vi.spyOn(minimal, "runMinimalSeed");
    const demoSpy = vi.spyOn(demo, "runDemoSeed");

    await expect(runSeed("demo", env)).rejects.toBeInstanceOf(BadgeEnvError);

    expect(minimalSpy).not.toHaveBeenCalled();
    expect(demoSpy).not.toHaveBeenCalled();
    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.smtpHost).toBe("smtp.reel.example");
  });

  it("refuse un mode inconnu", async () => {
    await expect(runSeed("bizarre", { BADGE_ENV: "dev" })).rejects.toThrow("SEED_MODE inconnu");
  });
});
