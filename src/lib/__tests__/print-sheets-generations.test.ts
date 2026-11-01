import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { toLayoutSpec } from "@/lib/print-sheets/layout-input";
import { pxToMm } from "@/lib/print-sheets/units";

const template = vi.hoisted(() => ({ pages: 2, w: "324px", h: "204px" }));
vi.mock("@/lib/badge-templates/render-badge", () => ({
  resolveEventTemplate: vi.fn(async () => ({
    meta: { pages: template.pages, pageSize: { width: template.w, height: template.h } },
  })),
}));

import {
  orderRegistrations,
  createGeneration,
  GenerationError,
  type GenerationSnapshot,
} from "@/lib/print-sheets/generations";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const layoutData = (name: string) => ({
  name,
  sheetWidth: 2100,
  sheetHeight: 2970,
  sheetOrientation: "PORTRAIT" as const,
  marginTop: 50,
  marginRight: 50,
  marginBottom: 50,
  marginLeft: 50,
  gapHorizontal: 20,
  gapVertical: 20,
  badgeOrientation: "AUTO" as const,
  duplexFlip: "LONG_EDGE" as const,
  cropMarks: true,
});

async function setup() {
  const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  const user = await prisma.user.create({
    data: { email: `${uniq("u")}@x`, password: "x", name: "U", isStaff: true, staffRole: "STAFF_SUPPORT" },
  });
  const layout = await prisma.printSheetLayout.create({ data: layoutData(uniq("lay")) });
  const catA = await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#000000", number: 2 } as never });
  const catB = await prisma.category.create({ data: { eventId: event.id, name: "B", color: "#000000", number: 10 } as never });
  return { org, event, user, layout, catA, catB };
}

let n = 0;
async function reg(
  eventId: string,
  categoryId: string,
  last: string,
  first: string,
  status: "APPROVED" | "PENDING" | "REJECTED" = "APPROVED",
) {
  n += 1;
  const p = await prisma.user.create({ data: { email: `p${n}-${Math.random()}@x`, password: "x", name: "P" } });
  return prisma.registration.create({
    data: {
      userId: p.id,
      id: `REG-${n}-${Math.random().toString(36).slice(2, 8)}`,
      eventId,
      categoryId,
      status,
      snapshotFirstName: first,
      snapshotLastName: last,
      snapshotEmail: `r${n}-${Math.random()}@x`,
      snapshotStructure: "S",
      snapshotPhoto: "",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "1",
      snapshotIdDocument: "",
    } as never,
  });
}

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(GenerationError);
    return e as GenerationError;
  }
  throw new Error("aucune erreur");
}

describe("orderRegistrations", () => {
  const row = (id: string, num: number, last: string, first: string) => ({
    id,
    category: { number: num },
    snapshotLastName: last,
    snapshotFirstName: first,
  });

  it("sorts category 2 before 10, then last name, first name, id; accents are neutral", () => {
    const rows = [
      row("a", 10, "Aaa", "A"),
      row("b", 2, "Zed", "A"),
      row("c", 2, "Dupont", "Emile"),
      row("d", 2, "Dupont", "Émile"),
      row("e", 2, "Dupont", "Alice"),
      row("f", 2, "Dupont", "Alice"),
    ];
    const out = orderRegistrations(rows).map((r) => r.id);
    expect(out).toEqual(["e", "f", "c", "d", "b", "a"]);
    expect(rows[0].id).toBe("a"); // entree non mutee
  });

  it("breaks full ties by id whatever the input order", () => {
    const a = row("a", 1, "Same", "Same");
    const b = row("b", 1, "Same", "Same");
    expect(orderRegistrations([a, b]).map((r) => r.id)).toEqual(["a", "b"]);
    expect(orderRegistrations([b, a]).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("places Émile with Emile rather than after Z", () => {
    const rows = [row("1", 1, "Martin", "Zoe"), row("2", 1, "Martin", "Émile"), row("3", 1, "Martin", "Eric")];
    expect(orderRegistrations(rows).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });
});

describe("createGeneration", () => {
  beforeEach(() => {
    template.pages = 2;
    template.w = "324px";
    template.h = "204px";
  });

  it("ALL keeps APPROVED only, freezes order and snapshot, output SHEETS", async () => {
    const { event, user, layout, catA, catB } = await setup();
    const r1 = await reg(event.id, catB.id, "Aaa", "A");
    const r2 = await reg(event.id, catA.id, "Zed", "A");
    const r3 = await reg(event.id, catA.id, "Bob", "A");
    await reg(event.id, catA.id, "Pend", "A", "PENDING");
    await reg(event.id, catA.id, "Rej", "A", "REJECTED");

    const g = await createGeneration({
      eventId: event.id,
      layoutId: layout.id,
      selection: { mode: "ALL" },
      duplex: true,
      userId: user.id,
    });
    expect(g.output).toBe("SHEETS");
    expect(g.status).toBe("PENDING");
    expect(g.duplex).toBe(true);
    expect(g.createdById).toBe(user.id);
    expect(g.layoutId).toBe(layout.id);
    expect(g.badgeCount).toBe(3);
    expect(g.registrationIds).toEqual([r3.id, r2.id, r1.id]);
    const snap = g.layoutSnapshot as unknown as GenerationSnapshot;
    expect(snap.spec).toEqual(toLayoutSpec(layout));
    expect(snap.badgeMm.width).toBeCloseTo(pxToMm(324));
    expect(snap.badgeMm.height).toBeCloseTo(pxToMm(204));
    expect(snap.badgePages).toBe(2);
  });

  it("CATEGORIES restricts to the chosen categories", async () => {
    const { event, user, layout, catA, catB } = await setup();
    await reg(event.id, catB.id, "Aaa", "A");
    const r2 = await reg(event.id, catA.id, "Zed", "A");
    const g = await createGeneration({
      eventId: event.id,
      layoutId: layout.id,
      selection: { mode: "CATEGORIES", categoryIds: [catA.id] },
      duplex: false,
      userId: user.id,
    });
    expect(g.registrationIds).toEqual([r2.id]);
  });

  it("IDS orders the given registrations and dedupes", async () => {
    const { event, user, layout, catA, catB } = await setup();
    const r1 = await reg(event.id, catB.id, "Aaa", "A");
    const r2 = await reg(event.id, catA.id, "Zed", "A");
    const g = await createGeneration({
      eventId: event.id,
      layoutId: layout.id,
      selection: { mode: "IDS", registrationIds: [r1.id, r2.id, r1.id] },
      duplex: false,
      userId: user.id,
    });
    expect(g.registrationIds).toEqual([r2.id, r1.id]);
  });

  it("logs PRINT_SHEETS_GENERATED", async () => {
    const { event, user, layout, catA } = await setup();
    await reg(event.id, catA.id, "Zed", "A");
    const g = await createGeneration({
      eventId: event.id,
      layoutId: layout.id,
      selection: { mode: "ALL" },
      duplex: false,
      userId: user.id,
    });
    const log = await prisma.activityLog.findFirst({ where: { type: "PRINT_SHEETS_GENERATED", targetId: g.id } });
    expect(log?.userId).toBe(user.id);
    expect(log?.details).toMatchObject({ eventId: event.id, badgeCount: 1, layoutId: layout.id });
  });

  it("LAYOUT_NOT_FOUND 404", async () => {
    const { event, user } = await setup();
    const e = await code(
      createGeneration({ eventId: event.id, layoutId: "nope", selection: { mode: "ALL" }, duplex: false, userId: user.id }),
    );
    expect(e.code).toBe("LAYOUT_NOT_FOUND");
    expect(e.httpStatus).toBe(404);
  });

  it("LAYOUT_NOT_FOUND 404 for an archived layout", async () => {
    const { event, user, layout } = await setup();
    await prisma.printSheetLayout.update({ where: { id: layout.id }, data: { archived: true, archivedAt: new Date() } });
    const e = await code(
      createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: user.id }),
    );
    expect(e.code).toBe("LAYOUT_NOT_FOUND");
    expect(e.httpStatus).toBe(404);
  });

  it("EVENT_NOT_FOUND 404", async () => {
    const { user, layout } = await setup();
    const e = await code(
      createGeneration({ eventId: "nope", layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: user.id }),
    );
    expect(e.code).toBe("EVENT_NOT_FOUND");
    expect(e.httpStatus).toBe(404);
  });

  it("EMPTY_SELECTION 400 when nothing is approved or the id list is empty", async () => {
    const { event, user, layout, catA } = await setup();
    await reg(event.id, catA.id, "Pend", "A", "PENDING");
    for (const selection of [
      { mode: "ALL" as const },
      { mode: "CATEGORIES" as const, categoryIds: [catA.id] },
      { mode: "IDS" as const, registrationIds: [] },
    ]) {
      const e = await code(createGeneration({ eventId: event.id, layoutId: layout.id, selection, duplex: false, userId: user.id }));
      expect(e.code).toBe("EMPTY_SELECTION");
      expect(e.httpStatus).toBe(400);
    }
  });

  it("INVALID_SELECTION 400 for non approved, foreign-event or unknown ids", async () => {
    const { event, user, layout, catA } = await setup();
    const other = await setup();
    const ok = await reg(event.id, catA.id, "Ok", "A");
    const pending = await reg(event.id, catA.id, "Pend", "A", "PENDING");
    const foreign = await reg(other.event.id, other.catA.id, "For", "A");
    for (const ids of [[ok.id, pending.id], [ok.id, foreign.id], [ok.id, "ghost"]]) {
      const e = await code(
        createGeneration({
          eventId: event.id,
          layoutId: layout.id,
          selection: { mode: "IDS", registrationIds: ids },
          duplex: false,
          userId: user.id,
        }),
      );
      expect(e.code).toBe("INVALID_SELECTION");
      expect(e.httpStatus).toBe(400);
    }
  });

  it("DUPLEX_UNAVAILABLE 400 for a one-page template", async () => {
    template.pages = 1;
    const { event, user, layout, catA } = await setup();
    await reg(event.id, catA.id, "Ok", "A");
    const e = await code(
      createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: true, userId: user.id }),
    );
    expect(e.code).toBe("DUPLEX_UNAVAILABLE");
    expect(e.httpStatus).toBe(400);
    // Sans recto-verso, un template d'une page est accepte.
    const g = await createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: user.id });
    expect((g.layoutSnapshot as unknown as GenerationSnapshot).badgePages).toBe(1);
  });

  it("BADGE_TOO_LARGE 400 when the badge does not fit", async () => {
    template.w = "2000px";
    template.h = "2000px";
    const { event, user, layout, catA } = await setup();
    await reg(event.id, catA.id, "Ok", "A");
    const e = await code(
      createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: user.id }),
    );
    expect(e.code).toBe("BADGE_TOO_LARGE");
    expect(e.httpStatus).toBe(400);
  });

  it("rethrows unexpected errors from computeSheetLayout", async () => {
    vi.resetModules();
    vi.doMock("@/lib/print-sheets/compute-layout", async (orig) => ({
      ...(await orig<typeof import("@/lib/print-sheets/compute-layout")>()),
      computeSheetLayout: () => {
        throw new Error("boom");
      },
    }));
    const mod = await import("@/lib/print-sheets/generations");
    const { event, user, layout, catA } = await setup();
    await reg(event.id, catA.id, "Ok", "A");
    await expect(
      mod.createGeneration({ eventId: event.id, layoutId: layout.id, selection: { mode: "ALL" }, duplex: false, userId: user.id }),
    ).rejects.toThrow("boom");
    vi.doUnmock("@/lib/print-sheets/compute-layout");
    vi.resetModules();
  });
});
