import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DemoContext } from "../../context";
import type { DemoWorld } from "../world";
import { buildWorld, teardownWorld } from "./helpers";

describe("loadWorld", () => {
  let ctx: DemoContext;
  let world: DemoWorld;

  beforeEach(async () => {
    ({ ctx, world } = await buildWorld());
  });
  afterEach(() => teardownWorld(ctx));

  it("relit organisations, staff et participants, tries par taille", async () => {
    expect(world.orgs.length).toBeGreaterThanOrEqual(12);
    expect(world.orgs.filter((o) => o.archived)).toHaveLength(1);
    expect(world.staff.length).toBeGreaterThan(0);
    expect(world.staff.every((u) => u.staffRole !== null)).toBe(true);
    expect(world.participants.length).toBeGreaterThan(0);
    expect(world.orgs.some((o) => o.owners.length > 0)).toBe(true);

    const size = (o: DemoWorld["orgs"][number]) => o.events.reduce((s, e) => s + e.countable, 0);
    const sizes = world.orgs.map(size);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(sizes[0]).toBeGreaterThan(0);
  });
});
