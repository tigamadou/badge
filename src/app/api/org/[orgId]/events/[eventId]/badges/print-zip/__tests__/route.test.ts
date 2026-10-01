import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// renderToBuffer delegue au vrai rendu, sauf le test d'echec de rendu.
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer: vi.fn(actual.renderToBuffer) };
});
import { renderToBuffer } from "@react-pdf/renderer";

import { createBadgeFixtures } from "@/lib/badge-templates/__tests__/badge-fixtures";
import { GET } from "../route";

function countPdfPages(buf: Buffer): number {
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

function call(orgId: string, eventId: string, query: string) {
  return GET(
    new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/badges/print-zip${query}`),
    { params: Promise.resolve({ orgId, eventId }) },
  );
}

describe("GET /api/org/[orgId]/events/[eventId]/badges/print-zip", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("renvoie un ZIP d'un PDF par badge, nommes et dans l'ordre demande", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration({ firstName: "Awa", lastName: "Diallo" });
    const b = await addRegistration({ anonymous: true });
    const c = await addRegistration({ firstName: "Éloïse", lastName: "N'Guessan" });

    const res = await call(org.id, event.id, `?ids=${c.id},${a.id},${b.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    const today = new Date().toISOString().slice(0, 10);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="badges-${event.slug}-${today}.zip"`,
    );

    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    const names = Object.keys(zip.files);
    expect(names).toEqual([`${c.id}-eloise-n-guessan.pdf`, `${a.id}-awa-diallo.pdf`, `${b.id}.pdf`]);
    for (const name of names) {
      const pdf = await zip.file(name)!.async("nodebuffer");
      expect(pdf.toString("latin1", 0, 5)).toBe("%PDF-");
      expect(countPdfPages(pdf)).toBe(1);
    }
  }, 60_000);

  it("un template recto-verso donne deux pages par fichier", async () => {
    const { org, event, addRegistration, rectoVersoId } = await createBadgeFixtures();
    await prisma.event.update({ where: { id: event.id }, data: { badgeTemplateId: rectoVersoId } });
    const a = await addRegistration();
    const zip = await JSZip.loadAsync(Buffer.from(await (await call(org.id, event.id, `?ids=${a.id}`)).arrayBuffer()));
    expect(countPdfPages(await zip.file(`${a.id}-awa-diallo.pdf`)!.async("nodebuffer"))).toBe(2);
  }, 30_000);

  it("un identifiant repete ne produit qu'un fichier", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const zip = await JSZip.loadAsync(
      Buffer.from(await (await call(org.id, event.id, `?ids=${a.id},${a.id}`)).arrayBuffer()),
    );
    expect(Object.keys(zip.files)).toEqual([`${a.id}-awa-diallo.pdf`]);
  }, 30_000);

  it("fonctionne sur un evenement archive", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true, archivedAt: new Date() } });
    expect((await call(org.id, event.id, `?ids=${a.id}`)).status).toBe(200);
  }, 30_000);

  it("400 VALIDATION sans identifiant", async () => {
    const { org, event } = await createBadgeFixtures();
    for (const q of ["", "?ids=", "?ids=,,"]) {
      const res = await call(org.id, event.id, q);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "VALIDATION" });
    }
  });

  it("400 VALIDATION au-dela de 200 identifiants", async () => {
    const { org, event } = await createBadgeFixtures();
    const ids = Array.from({ length: 201 }, (_, i) => `id-${i}`).join(",");
    const res = await call(org.id, event.id, `?ids=${ids}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "VALIDATION" });
  });

  it("404 NOT_FOUND listant les identifiants inconnus ou d'un autre evenement", async () => {
    const other = await createBadgeFixtures();
    const foreign = await other.addRegistration();
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const res = await call(org.id, event.id, `?ids=${a.id},ghost-xyz,${foreign.id}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND", ids: ["ghost-xyz", foreign.id] });
  });

  it("409 NOT_APPROVED listant les inscriptions non approuvees", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const p = await addRegistration({ status: "PENDING" });
    const r = await addRegistration({ status: "REJECTED" });
    const res = await call(org.id, event.id, `?ids=${a.id},${p.id},${r.id}`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "NOT_APPROVED", ids: [p.id, r.id] });
  });

  it("403 pour un VIEWER sans badge.print", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures({ role: "VIEWER", orgOwner: false });
    const a = await addRegistration();
    const res = await call(org.id, event.id, `?ids=${a.id}`);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("EVENT_FORBIDDEN");
  });

  it("autorise un PRINTER pur", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures({ role: "PRINTER", orgOwner: false });
    const a = await addRegistration();
    expect((await call(org.id, event.id, `?ids=${a.id}`)).status).toBe(200);
  }, 30_000);

  it("500 RENDER_FAILED sans archive partielle si un rendu echoue", async () => {
    const { org, event, addRegistration } = await createBadgeFixtures();
    const a = await addRegistration();
    const b = await addRegistration();
    const actual = vi.mocked(renderToBuffer).getMockImplementation()!;
    vi.mocked(renderToBuffer)
      .mockImplementationOnce(actual)
      .mockRejectedValueOnce(new Error("boom-render"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(org.id, event.id, `?ids=${a.id},${b.id}`);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "RENDER_FAILED", id: b.id });
    err.mockRestore();
  }, 30_000);
});
