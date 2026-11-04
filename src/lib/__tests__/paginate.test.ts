import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { paginate, paginateArray } from "@/lib/paginate";
import { makeOrg, seedFactories } from "@/test/factories";

const PREFIX = "pgn-";

async function seedOrgs(n: number) {
  for (let i = 0; i < n; i++) await makeOrg({ name: `${PREFIX}${String(i).padStart(3, "0")}` });
}

const where = { name: { startsWith: PREFIX } };
const run = (page: number, pageSize: number, find = vi.fn()) =>
  paginate(
    { page, pageSize },
    () => prisma.organization.count({ where }),
    (range) => {
      find(range);
      return prisma.organization.findMany({ where, orderBy: { name: "asc" }, ...range });
    },
  );

describe("paginate", () => {
  beforeAll(() => seedFactories(11));

  it("lit la tranche demandee", async () => {
    await seedOrgs(45);
    const r = await run(2, 20);
    expect(r).toMatchObject({ total: 45, page: 2, pageSize: 20, totalPages: 3 });
    expect(r.rows).toHaveLength(20);
  });

  it("borne une page trop haute a la derniere", async () => {
    await seedOrgs(45);
    const r = await run(99, 20);
    expect(r.page).toBe(3);
    expect(r.rows).toHaveLength(5);
  });

  it("ramene une page nulle, negative ou non finie a 1", async () => {
    await seedOrgs(3);
    expect((await run(0, 20)).page).toBe(1);
    expect((await run(-4, 20)).page).toBe(1);
    expect((await run(Number.NaN, 20)).page).toBe(1);
  });

  it("table vide : aucune lecture", async () => {
    const find = vi.fn();
    const r = await run(3, 20, find);
    expect(r).toMatchObject({ rows: [], total: 0, page: 1, totalPages: 1 });
    expect(find).not.toHaveBeenCalled();
  });
});

describe("paginateArray", () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);

  it("renvoie la derniere tranche", () => {
    const r = paginateArray(items, { page: 3, pageSize: 20 });
    expect(r.rows).toEqual([41, 42, 43, 44, 45]);
    expect(r).toMatchObject({ total: 45, totalPages: 3, page: 3 });
  });

  it("borne la page et gere le vide", () => {
    expect(paginateArray(items, { page: 50, pageSize: 20 }).page).toBe(3);
    expect(paginateArray([], { page: 4, pageSize: 20 })).toMatchObject({ rows: [], total: 0, page: 1, totalPages: 1 });
  });
});
