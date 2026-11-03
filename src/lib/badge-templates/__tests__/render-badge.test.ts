import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import { createBadgeFixtures } from "./badge-fixtures";
import {
  loadBadgeRegistration,
  renderBadgeDocument,
  renderBadgeHtml,
  renderBadgePdf,
  resolveEventTemplate,
  BadgeRenderError,
  BadgeTooLargeError,
  badgeRenderFailure,
} from "../render-badge";
import { __TEST__ } from "../build-context";
import { ExportError } from "@tigamadou/pdf-engine/export";
import { countPdfPages, fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";

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

  it("rend le document vivant avec le template de la plateforme (famille default)", async () => {
    const { addRegistration, defaultId } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration(
      (await addRegistration({ firstName: "Anne-Marie", lastName: "Diallo" })).id,
    ))!;
    const { document, templateId } = await renderBadgeDocument(reg);
    expect(document.frozen).toBe(false);
    expect(document.pages).toEqual([1]);
    expect(document.html.startsWith("<!doctype html>")).toBe(true);
    const text = document.html.replaceAll("\u2060", "");
    expect(text).toContain("Anne-Marie");
    expect(text).toContain("Diallo");
    expect(templateId).toBe(defaultId);
    expect(fakeExporter.calls).toEqual([]);
  }, 30_000);

  it("rend deux pages avec le template recto-verso de l'evenement", async () => {
    const { event, addRegistration, rectoVersoId } = await createBadgeFixtures();
    await prisma.event.update({ where: { id: event.id }, data: { badgeTemplateId: rectoVersoId } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { document, templateId } = await renderBadgeDocument(reg);
    expect(document.pages).toEqual([1, 2]);
    expect(templateId).toBe(rectoVersoId);
  }, 30_000);

  it("fige le document par le service, sans script ni WORD JOINER", async () => {
    const { addRegistration } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { document } = await renderBadgeHtml(reg);
    expect(document.frozen).toBe(true);
    expect(document.html).not.toContain("<script");
    expect(document.html).not.toContain("\u2060");
    expect(fakeExporter.calls.map((c) => c.op)).toEqual(["freeze"]);
  }, 30_000);

  it("produit un PDF par le service a partir du document vivant", async () => {
    const { addRegistration } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { pdf } = await renderBadgePdf(reg);
    expect(Buffer.from(pdf).toString("latin1", 0, 5)).toBe("%PDF-");
    expect(countPdfPages(pdf)).toBe(1);
    expect(fakeExporter.calls).toHaveLength(1);
    expect(fakeExporter.calls[0].op).toBe("pdf");
    expect(fakeExporter.calls[0].doc.frozen).toBe(false);
  }, 30_000);

  it("propage l'indisponibilite du service", async () => {
    const { addRegistration } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    fakeExporter.failNext("UNAVAILABLE");
    await expect(renderBadgePdf(reg)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  }, 30_000);

  it("refuse un badge trop lourd avant tout appel au service", async () => {
    const { addRegistration } = await createBadgeFixtures();
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const spy = vi
      .spyOn(__TEST__, "readFileAsDataUrl")
      .mockResolvedValue(`data:image/jpeg;base64,${"A".repeat(21 * 1024 * 1024)}`);
    await expect(renderBadgePdf(reg)).rejects.toThrow(/trop volumineux/);
    expect(fakeExporter.calls).toEqual([]);
    spy.mockRestore();
  }, 30_000);

  it("se replie sur le template de l'organisation quand l'evenement n'en a pas", async () => {
    const { org, addRegistration, rectoVersoId } = await createBadgeFixtures();
    await prisma.organization.update({ where: { id: org.id }, data: { badgeTemplateId: rectoVersoId } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { templateId } = await renderBadgeDocument(reg);
    expect(templateId).toBe(rectoVersoId);
  }, 30_000);

  it("se replie sur la famille default sans PlatformSettings", async () => {
    const { addRegistration, defaultId } = await createBadgeFixtures();
    await prisma.platformSettings.delete({ where: { id: "singleton" } });
    const reg = (await loadBadgeRegistration((await addRegistration()).id))!;
    const { templateId } = await renderBadgeDocument(reg);
    expect(templateId).toBe(defaultId);
  }, 30_000);

  it("resolveEventTemplate : famille default sans template, recto-verso via l'organisation", async () => {
    const { event, org, defaultId, rectoVersoId } = await createBadgeFixtures();
    expect((await resolveEventTemplate(event)).meta.id).toBe(defaultId);
    await prisma.organization.update({ where: { id: org.id }, data: { badgeTemplateId: rectoVersoId } });
    expect((await resolveEventTemplate(event)).meta.id).toBe(rectoVersoId);
  });
});

describe("BadgeRenderError / badgeRenderFailure", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("BadgeRenderError garde l'inscription fautive et l'erreur d'origine", () => {
    const original = new Error("boom");
    const err = new BadgeRenderError("reg-1", original);
    expect(err.registrationId).toBe("reg-1");
    expect(err.original).toBe(original);
    expect(err.message).toContain("reg-1");
  });

  it("repond 503 quand le service de rendu est indisponible", async () => {
    const res = badgeRenderFailure(new ExportError("UNAVAILABLE", "x"), "reg-1", "route");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("RENDERER_UNAVAILABLE");
  });

  it("repond 500 avec le message pour un badge trop lourd", async () => {
    const res = badgeRenderFailure(new BadgeTooLargeError("badge trop volumineux"), "reg-1", "route");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: "RENDER_FAILED", id: "reg-1" });
    expect(body.message).toMatch(/volumineux/);
  });

  it("repond 500 sans message pour toute autre erreur", async () => {
    const res = badgeRenderFailure(new Error("secret"), "reg-1", "route");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "RENDER_FAILED", id: "reg-1" });
  });
});
