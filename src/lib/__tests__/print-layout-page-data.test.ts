import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeStaff, makeUser } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import {
  canWriteLayouts,
  loadTemplateOptions,
  toLayoutRow,
} from "@/lib/print-sheets/layout-page-data";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function staff(staffRole: "STAFF_ADMIN" | "STAFF_OBSERVER" | null) {
  const user = await prisma.user.create({
    data: { email: `pl-${stamp()}@x.test`, password: "x", name: "U", isStaff: staffRole !== null, staffRole },
  });
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
  return user;
}

async function installedTemplate(installedById: string, pages: 1 | 2, archived = false) {
  const label = `PL ${stamp()}`;
  return prisma.installedBadgeTemplate.create({
    data: {
      family: `pl-${stamp()}`,
      version: 1,
      label,
      description: "",
      pages,
      pageWidthPx: 320,
      pageHeightPx: 460,
      layout: { formatVersion: 3, page: { widthPx: 320, heightPx: 460, count: pages } },
      bindings: {},
      assetPrefix: "badge-templates/pl/",
      formatVersion: 3,
      installedById,
      archived,
    },
  });
}

describe("canWriteLayouts", () => {
  it("refuse sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect(await canWriteLayouts()).toBe(false);
  });

  it("accorde l'écriture à STAFF_ADMIN et la refuse à STAFF_OBSERVER et aux non-staff", async () => {
    await staff("STAFF_ADMIN");
    expect(await canWriteLayouts()).toBe(true);
    await staff("STAFF_OBSERVER");
    expect(await canWriteLayouts()).toBe(false);
    await staff(null);
    expect(await canWriteLayouts()).toBe(false);
  });
});

describe("canWriteLayouts par rôle système", () => {
  it("SA et AD vrai ; SU, PR, OB et non staff faux", async () => {
    const expected = { SUPER_ADMIN: true, STAFF_ADMIN: true, STAFF_SUPPORT: false, STAFF_PRINTER: false, STAFF_OBSERVER: false } as const;
    for (const [role, ok] of Object.entries(expected)) {
      const user = await makeStaff(role as keyof typeof expected);
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
      expect(await canWriteLayouts(), role).toBe(ok);
    }
    const plain = await makeUser();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: plain.id } } as never);
    expect(await canWriteLayouts()).toBe(false);
  });
});

describe("loadTemplateOptions", () => {
  it("expose le nombre de pages et la taille en mm, sans les templates archivés", async () => {
    const admin = await staff("STAFF_ADMIN");
    const duplex = await installedTemplate(admin.id, 2);
    const archived = await installedTemplate(admin.id, 1, true);

    const options = await loadTemplateOptions();
    const found = options.find((o) => o.id === duplex.id);
    expect(found).toMatchObject({ label: duplex.label, pages: 2 });
    expect(found?.widthMm).toBeCloseTo((320 * 25.4) / 96, 5);
    expect(found?.heightMm).toBeCloseTo((460 * 25.4) / 96, 5);
    expect(options.some((o) => o.id === archived.id)).toBe(false);
  });
});

describe("toLayoutRow", () => {
  it("ne garde que les champs de la ligne d'affichage", async () => {
    const layout = await prisma.printSheetLayout.create({
      data: {
        name: `PL ${stamp()}`,
        sheetWidth: 2970,
        sheetHeight: 4200,
        sheetOrientation: "PORTRAIT",
        marginTop: 100,
        marginRight: 110,
        marginBottom: 120,
        marginLeft: 130,
        gapHorizontal: 20,
        gapVertical: 30,
        duplexFlip: "SHORT_EDGE",
        cropMarks: false,
      },
    });
    expect(toLayoutRow(layout)).toEqual({
      id: layout.id,
      name: layout.name,
      sheetWidth: 2970,
      sheetHeight: 4200,
      sheetOrientation: "PORTRAIT",
      marginTop: 100,
      marginRight: 110,
      marginBottom: 120,
      marginLeft: 130,
      gapHorizontal: 20,
      gapVertical: 30,
      badgeOrientation: "AUTO",
      duplexFlip: "SHORT_EDGE",
      cropMarks: false,
    });
  });
});
