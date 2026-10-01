import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { createBadgeFixtures } from "./badge-fixtures";
import { resolveEventTemplateVariables } from "../event-template-variables";

const VARIABLES = [{ name: "showColorBar", kind: "boolean", label: "Bandeau", sample: true }];

async function installRow(family: string, over: Record<string, unknown> = {}) {
  const admin = await prisma.user.findFirstOrThrow({ select: { id: true } });
  return prisma.installedBadgeTemplate.create({
    data: {
      family: `${family}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      version: 1,
      label: family,
      description: "",
      pages: 1,
      pageWidthPx: 320,
      pageHeightPx: 460,
      layout: { formatVersion: 2, variables: VARIABLES, blocks: [] },
      bindings: { showColorBar: "option" },
      assetPrefix: "badge-templates/none/",
      formatVersion: 2,
      installedById: admin.id,
      ...over,
    },
  });
}

describe("resolveEventTemplateVariables", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lit les variables et liaisons du template de l'evenement", async () => {
    const { event } = await createBadgeFixtures();
    const row = await installRow("evt");
    expect(await resolveEventTemplateVariables({ badgeTemplateId: row.id, orgId: event.orgId })).toEqual({
      variables: VARIABLES,
      bindings: { showColorBar: "option" },
    });
  });

  it("se replie sur le template de l'organisation", async () => {
    const { event, org } = await createBadgeFixtures();
    const row = await installRow("org");
    await prisma.organization.update({ where: { id: org.id }, data: { badgeTemplateId: row.id } });
    const out = await resolveEventTemplateVariables({ badgeTemplateId: null, orgId: event.orgId });
    expect(out.variables).toEqual(VARIABLES);
  });

  it("se replie sur le template de la plateforme", async () => {
    const { event } = await createBadgeFixtures();
    const row = await installRow("plat");
    await prisma.platformSettings.update({ where: { id: "singleton" }, data: { badgeTemplateId: row.id } });
    const out = await resolveEventTemplateVariables({ badgeTemplateId: null, orgId: event.orgId });
    expect(out.variables).toEqual(VARIABLES);
  });

  it("retombe sur la famille default quand l'identifiant est inconnu", async () => {
    const { event, defaultId } = await createBadgeFixtures();
    const def = await prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id: defaultId } });
    const out = await resolveEventTemplateVariables({ badgeTemplateId: "inconnu", orgId: event.orgId });
    expect(out.variables).toEqual((def.layout as { variables: unknown[] }).variables);
  });

  it("rend du vide et journalise quand aucune ligne default n'existe", async () => {
    const { event } = await createBadgeFixtures();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(prisma.installedBadgeTemplate, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.installedBadgeTemplate, "findFirst").mockResolvedValue(null);
    expect(await resolveEventTemplateVariables({ badgeTemplateId: "x", orgId: event.orgId })).toEqual({
      variables: [],
      bindings: {},
    });
    expect(warn).toHaveBeenCalled();
  });

  it("rend du vide quand le layout est mal forme", async () => {
    const { event } = await createBadgeFixtures();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = await installRow("bad", { layout: "n'importe quoi" });
    expect(await resolveEventTemplateVariables({ badgeTemplateId: row.id, orgId: event.orgId })).toEqual({
      variables: [],
      bindings: {},
    });
    expect(warn).toHaveBeenCalled();
  });

  it("traite une table de liaison qui n'est pas un objet comme vide", async () => {
    const { event } = await createBadgeFixtures();
    const row = await installRow("liaisons", { bindings: ["x"] });
    expect(await resolveEventTemplateVariables({ badgeTemplateId: row.id, orgId: event.orgId })).toEqual({
      variables: VARIABLES,
      bindings: {},
    });
  });

  it("rend du vide quand la lecture leve", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(prisma.organization, "findUnique").mockRejectedValue(new Error("db"));
    expect(await resolveEventTemplateVariables({ badgeTemplateId: null, orgId: "o" })).toEqual({
      variables: [],
      bindings: {},
    });
    expect(warn).toHaveBeenCalled();
  });
});
