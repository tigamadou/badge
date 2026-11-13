import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeEvent, makeEventMember, makeOrg, makeOrgMember, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { getServerSession } from "next-auth";
import EventDashboardPage from "../page";

seedFactories(2401);

async function render(user: { id: string; email: string; name: string }, eventId: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { ...user, isStaff: false } } as never);
  const el = await EventDashboardPage({ params: Promise.resolve({ eventId }) });
  return renderToStaticMarkup(el);
}

describe("tableau de bord de l'évènement", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("VIEWER : compteurs agrégés, sans « Dernières inscriptions »", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const html = await render(await makeEventMember(event.id, "VIEWER"), event.id);
    expect(html).toContain("En attente");
    expect(html).not.toContain("Dernières inscriptions");
    expect(html).not.toContain("Mes scans");
  });

  it("OPERATOR : « Mes scans » et le scanner", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const html = await render(await makeEventMember(event.id, "OPERATOR"), event.id);
    expect(html).toContain("Mes scans");
    expect(html).toContain(`/event/${event.id}/scan`);
  });

  it("AGENT d'organisation : « Mes scans » et « Poste sur place », sans compteurs ni inscriptions", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const html = await render(await makeOrgMember(org.id, "AGENT"), event.id);
    expect(html).toContain("Mes scans");
    expect(html).toContain(`/event/${event.id}/print/onsite`);
    expect(html).not.toContain("Dernières inscriptions");
    expect(html).not.toContain("En attente");
  });

  it("ADMIN : dernières inscriptions", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const html = await render(await makeEventMember(event.id, "ADMIN"), event.id);
    expect(html).toContain("Dernières inscriptions");
  });

  it("PRINTER : redirigé vers sa première entrée de menu", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const user = await makeEventMember(event.id, "PRINTER");
    vi.mocked(getServerSession).mockResolvedValue({ user: { ...user, isStaff: false } } as never);
    await expect(EventDashboardPage({ params: Promise.resolve({ eventId: event.id }) })).rejects.toThrow(
      `REDIRECT:/event/${event.id}/badges`,
    );
  });
});
