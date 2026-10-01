import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import { createBadgeFixtures } from "./badge-fixtures";
import { loadBadgeRegistration, renderBadgePdf, resolveEventTemplate } from "../render-badge";

function countPdfPages(buf: Buffer): number {
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

describe("loadBadgeRegistration / renderBadgePdf", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("renvoie null pour une inscription inconnue", async () => {
    expect(await loadBadgeRegistration("ghost-xyz")).toBeNull();
  });

  it("charge l'inscription avec evenement et categorie", async () => {
    const { event, addRegistration } = await createBadgeFixtures();
    const reg = await addRegistration({ anonymous: true });
    const loaded = await loadBadgeRegistration(reg.id);
    expect(loaded?.eventId).toBe(event.id);
    expect(loaded?.status).toBe("APPROVED");
    expect(loaded?.category.anonymous).toBe(true);
    expect(loaded?.event.orgId).toBe(event.orgId);
  });

  it("rend une page avec le template de la plateforme (famille default)", async () => {
    const { addRegistration, defaultId } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { pdf, templateId } = await renderBadgePdf(reg);
    expect(pdf.toString("latin1", 0, 5)).toBe("%PDF-");
    expect(countPdfPages(pdf)).toBe(1);
    expect(templateId).toBe(defaultId);
  }, 30_000);

  it("rend deux pages avec le template recto-verso de l'evenement", async () => {
    const { event, addRegistration, rectoVersoId } = await createBadgeFixtures();
    await prisma.event.update({ where: { id: event.id }, data: { badgeTemplateId: rectoVersoId } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { pdf, templateId } = await renderBadgePdf(reg);
    expect(countPdfPages(pdf)).toBe(2);
    expect(templateId).toBe(rectoVersoId);
  }, 30_000);

  it("se replie sur le template de l'organisation quand l'evenement n'en a pas", async () => {
    const { org, addRegistration, rectoVersoId } = await createBadgeFixtures();
    await prisma.organization.update({ where: { id: org.id }, data: { badgeTemplateId: rectoVersoId } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { templateId } = await renderBadgePdf(reg);
    expect(templateId).toBe(rectoVersoId);
  }, 30_000);

  it("se replie sur la famille default sans PlatformSettings", async () => {
    const { addRegistration, defaultId } = await createBadgeFixtures();
    await prisma.platformSettings.delete({ where: { id: "singleton" } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { templateId } = await renderBadgePdf(reg);
    expect(templateId).toBe(defaultId);
  }, 30_000);

  it("resolveEventTemplate : famille default sans template, recto-verso via l'organisation", async () => {
    const { event, org, defaultId, rectoVersoId } = await createBadgeFixtures();
    expect((await resolveEventTemplate(event)).meta.id).toBe(defaultId);
    await prisma.organization.update({ where: { id: org.id }, data: { badgeTemplateId: rectoVersoId } });
    expect((await resolveEventTemplate(event)).meta.id).toBe(rectoVersoId);
  });
});
