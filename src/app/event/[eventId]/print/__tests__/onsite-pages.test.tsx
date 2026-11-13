import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { seedFactories } from "@/test/factories";
import { as, seedOnsiteScene } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/onsite/__tests__/helpers";
import { getServerSession } from "next-auth";
import OnsiteOrdersPage from "../onsite/page";
import EventOnsiteStationPage from "../[requestId]/onsite/page";

seedFactories(2402);

describe("pages du poste sur place de l'agent", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("liste : l'agent voit les commandes ouvertes de l'évènement, pas celles d'un autre", async () => {
    const s = await seedOnsiteScene();
    const mine = await s.order();
    const other = await s.otherEventOrder();
    as(s.agent);
    const html = renderToStaticMarkup(await OnsiteOrdersPage({ params: Promise.resolve({ eventId: s.fx.event.id }) }));
    expect(html).toContain(mine.reference);
    expect(html).not.toContain(other.reference);
    expect(html).not.toMatch(/FCFA|300\s?000/);
  });

  it("liste : un auditeur est renvoyé au tableau de bord", async () => {
    const s = await seedOnsiteScene();
    as(s.auditor);
    await expect(OnsiteOrdersPage({ params: Promise.resolve({ eventId: s.fx.event.id }) })).rejects.toThrow(
      `REDIRECT:/event/${s.fx.event.id}`,
    );
  });

  it("poste : rendu pour l'agent, 404 pour une commande d'un autre évènement ou d'une autre organisation", async () => {
    const s = await seedOnsiteScene();
    const mine = await s.order();
    as(s.agent);
    const html = renderToStaticMarkup(
      await EventOnsiteStationPage({ params: Promise.resolve({ eventId: s.fx.event.id, requestId: mine.id }) }),
    );
    expect(html).toContain(mine.reference);
    for (const foreign of [await s.otherEventOrder(), await s.foreignOrgOrder()]) {
      await expect(
        EventOnsiteStationPage({ params: Promise.resolve({ eventId: s.fx.event.id, requestId: foreign.id }) }),
      ).rejects.toThrow("NOT_FOUND");
    }
  });

  it("poste : une commande qui n'est plus imprimable renvoie à la liste", async () => {
    const s = await seedOnsiteScene();
    const done = await s.order({ status: "COMPLETED" });
    as(s.agent);
    await expect(
      EventOnsiteStationPage({ params: Promise.resolve({ eventId: s.fx.event.id, requestId: done.id }) }),
    ).rejects.toThrow(`REDIRECT:/event/${s.fx.event.id}/print/onsite`);
  });
});
