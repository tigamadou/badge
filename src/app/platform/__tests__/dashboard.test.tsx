import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeCustomRole, makeEvent, makeOrg, makePrintOrder, makeStaff, makeUser } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import { getServerSession } from "next-auth";
import StaffDashboardPage from "../page";

async function render(userId: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
  return renderToStaticMarkup(await StaffDashboardPage());
}

describe("tableau de bord plateforme", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("l'Observateur voit les chiffres et le journal, sans bloc impression", async () => {
    const u = await makeStaff("STAFF_OBSERVER");
    const html = await render(u.id);
    expect(html).toContain("Organisations actives");
    expect(html).toContain("Top organisations");
    expect(html).toContain("Activité récente");
    expect(html).not.toContain("Commandes à traiter");
    expect(html).not.toContain("Planches à générer");
  });

  it("l'Imprimeur voit le bloc impression, sans chiffres des organisations ni journal", async () => {
    const u = await makeStaff("STAFF_PRINTER");
    const html = await render(u.id);
    expect(html).toContain("Commandes à traiter");
    expect(html).toContain("Planches à générer");
    expect(html).toContain('href="/platform/print/orders"');
    expect(html).toContain('href="/platform/print/sheets"');
    expect(html).not.toContain("Organisations actives");
    expect(html).not.toContain("Top organisations");
    expect(html).not.toContain("Activité récente");
  });

  it("un rôle limité aux commandes n'affiche pas les planches", async () => {
    const role = await makeCustomRole({ scope: "PLATFORM", permissions: ["platform.access", "print.requests.read"] });
    const u = await makeUser({ isStaff: true, platformRoleId: role.id });
    const html = await render(u.id);
    expect(html).toContain("Commandes à traiter");
    expect(html).not.toContain("Planches à générer");
  });

  it("un rôle sans aucune lecture n'affiche aucun bloc vide", async () => {
    const role = await makeCustomRole({ scope: "PLATFORM", permissions: ["platform.access"] });
    const u = await makeUser({ isStaff: true, platformRoleId: role.id });
    const html = await render(u.id);
    expect(html).toContain("Tableau de bord");
    expect(html).not.toContain("Organisations actives");
    expect(html).not.toContain("Impression");
    expect(html).not.toContain("Activité récente");
    expect(html).not.toContain("grid-cols-1 gap-6");
  });

  it("l'Imprimeur voit le compte réel de commandes à traiter", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    await makePrintOrder({ eventId: event.id, orgId: org.id, status: "SUBMITTED" });
    await makePrintOrder({ eventId: event.id, orgId: org.id, status: "SUBMITTED" });
    await makePrintOrder({ eventId: event.id, orgId: org.id, status: "DRAFT" });
    const u = await makeStaff("STAFF_PRINTER");
    const html = await render(u.id);
    expect(html).toMatch(/Commandes à traiter<\/p>.*?>2<\/p>/);
  });
});
