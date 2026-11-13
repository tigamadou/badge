import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeEvent, makeOrg, makePayment, makePlan, makePrintOrder, makeStaff } from "@/test/factories";

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
import PrintRequestDetailPage from "../page";

async function props(userId: string, requestId: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
  const element = await PrintRequestDetailPage({ params: Promise.resolve({ requestId }) });
  return element.props as { payments: unknown[]; credit: unknown };
}

async function order() {
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  const request = await makePrintOrder({ eventId: event.id, orgId: org.id });
  const plan = await makePlan();
  await makePayment(org.id, { planId: plan.id, printRequestId: request.id });
  return request;
}

describe("fiche d'une commande plateforme", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("l'Imprimeur ne reçoit ni paiements ni crédit de l'organisation", async () => {
    const printer = await makeStaff("STAFF_PRINTER");
    const p = await props(printer.id, (await order()).id);
    expect(p.payments).toEqual([]);
    expect(p.credit).toBeNull();
  });

  it("l'Administrateur reçoit les paiements et le crédit", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const p = await props(admin.id, (await order()).id);
    expect(p.payments).toHaveLength(1);
    expect(p.credit).not.toBeNull();
  });
});
