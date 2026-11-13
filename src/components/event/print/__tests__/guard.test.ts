import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeOrgMember, makeEventMember } from "@/test/factories";

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
import { requirePrintAccess } from "../guard";

async function seedEvent() {
  const org = await prisma.organization.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Evt", slug: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, location: "L", date: new Date() },
  });
  return { org, event };
}

describe("requirePrintAccess", () => {
  it("membre ADMIN d'évènement passe ; OPERATOR et AGENT sont redirigés vers /event/{id}", async () => {
    const { event } = await seedEvent();
    const admin = await makeEventMember(event.id, "ADMIN");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: admin.id } } as never);
    expect((await requirePrintAccess(event.id, "/print")).event.id).toBe(event.id);

    const operator = await makeEventMember(event.id, "OPERATOR");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: operator.id } } as never);
    await expect(requirePrintAccess(event.id, "/print")).rejects.toThrow(`REDIRECT:/event/${event.id}`);

    const agent = await makeOrgMember(event.orgId, "AGENT");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: agent.id } } as never);
    await expect(requirePrintAccess(event.id, "/print")).rejects.toThrow(`REDIRECT:/event/${event.id}`);
  });
});
