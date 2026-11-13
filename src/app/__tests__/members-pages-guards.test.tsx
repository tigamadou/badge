import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { getServerSession } from "next-auth";
import PlatformUsersPage from "@/app/platform/users/page";
import OrgMembersPage from "@/app/org/[orgId]/members/page";
import EventMembersPage from "@/app/event/[eventId]/members/page";

const noQuery = { searchParams: Promise.resolve({}) };

function loginAs(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id } } as never);
}

// Une entrée de menu masquée ne protège pas une page : chaque page de liste de membres porte sa propre garde.
describe("pages de membres : garde de page par permission", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("/platform/users : l'Imprimeur (sans users.read) est renvoyé au tableau de bord", async () => {
    loginAs((await makeStaff("STAFF_PRINTER")).id);
    await expect(PlatformUsersPage(noQuery)).rejects.toThrow("REDIRECT:/platform");
  });

  it("/org/[orgId]/members : l'Agent (sans org.members.read) est renvoyé au tableau de bord", async () => {
    const org = await makeOrg();
    loginAs((await makeOrgMember(org.id, "AGENT")).id);
    await expect(OrgMembersPage({ params: Promise.resolve({ orgId: org.id }), ...noQuery })).rejects.toThrow(
      `REDIRECT:/org/${org.id}`,
    );
  });

  it("/event/[eventId]/members : un Observateur d'évènement est renvoyé à l'atterrissage", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    loginAs((await makeEventMember(event.id, "VIEWER")).id);
    await expect(EventMembersPage({ params: Promise.resolve({ eventId: event.id }), ...noQuery })).rejects.toThrow(
      `REDIRECT:/event/${event.id}`,
    );
  });
});
