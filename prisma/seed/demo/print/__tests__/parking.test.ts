import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { seedCatalog } from "../catalog";
import { conversationHooks } from "../conversation";
import { createPrintState, DAY_MS } from "../helpers";
import { runScenario, type Phase, type ScenarioHooks } from "../orders";
import { SCENARIOS } from "../scenarios";
import { buildWorld, disposeWorld } from "./helpers";

const PHASES: Phase[] = ["draft", "submitted", "revision", "quoted", "accepted", "paid", "produced", "done"];

describe("parcage immediat des jobs d'email", () => {
  let ctx: DemoContext;

  afterEach(async () => {
    await disposeWorld(ctx);
  });

  it("ne laisse aucun job d'impression executable a aucune etape du cycle", async () => {
    ctx = await buildWorld();
    const state = createPrintState(ctx);
    await seedCatalog(ctx, state);
    const conversation = conversationHooks(ctx, state);
    const exposed: Array<{ phase: Phase; count: number }> = [];
    const hooks: ScenarioHooks = {};
    for (const phase of PHASES) {
      hooks[phase] = async (ref) => {
        await conversation[phase]?.(ref);
        const count = await prisma.job.count({
          where: {
            kind: { startsWith: "notification.print_request" },
            status: "PENDING",
            runAt: { lt: new Date(Date.now() + DAY_MS) },
          },
        });
        exposed.push({ phase, count });
      };
    }
    const scenario = SCENARIOS.find((s) => s.key === "a-completed")!;
    await runScenario(ctx, state, scenario, hooks);

    expect(await prisma.job.count({ where: { kind: { startsWith: "notification.print_request" } } })).toBeGreaterThan(0);
    expect(exposed.map((e) => e.phase)).toEqual(expect.arrayContaining(["submitted", "quoted", "accepted", "paid", "produced", "done"]));
    expect(exposed.filter((e) => e.count > 0)).toEqual([]);
  }, 300_000);
});
