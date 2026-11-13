import { vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  makeCategory, makeEvent, makeEventMember, makeOrg, makeOrgMember, makeRegistration, makeStaff,
} from "@/test/factories";
import { seedPrintFixture, makeRequest } from "@/lib/__tests__/helpers/print-requests";
import { getServerSession } from "next-auth";

type Actor = { id: string; email: string; name: string };

export function as(user: Actor | null, isStaff = false) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff } } : null) as never,
  );
}

type Handler = (req: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Appelle une route du poste sur place d'organisation et renvoie statut + corps JSON. */
export async function callOnsite(
  handler: unknown,
  scope: { orgId: string; eventId: string; requestId: string },
  sub: string,
  method: "GET" | "POST",
  body?: unknown,
  raw?: string,
) {
  const req = new NextRequest(
    `http://localhost/api/org/${scope.orgId}/events/${scope.eventId}/print-requests/${scope.requestId}/onsite${sub}`,
    {
      method,
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      headers: { "content-type": "application/json" },
    },
  );
  const res = await (handler as Handler)(req, { params: Promise.resolve(scope) });
  return { status: res.status, json: await res.json() };
}

// Commande sur place IN_PRODUCTION de 200 badges, marge 10 %, sur l'évènement du jeu de données.
export async function seedOnsiteScene() {
  const fx = await seedPrintFixture();
  const order = async (over: Parameters<typeof makeRequest>[1] = {}, target = fx) => {
    const r = await makeRequest(target, {
      type: "ONSITE", status: "IN_PRODUCTION", estimatedQuantity: 200, marginPercent: 10,
      onsiteLocation: "Hall A", ...over,
    });
    await prisma.printQuoteLine.create({
      data: {
        requestId: r.id, kind: "PRODUCT", productId: fx.badgeProduct.id, label: "Badge",
        quantity: 200, unitPrice: 1500, lineTotal: 300000, position: 0, addedBy: "ORGANIZER",
      },
    });
    return r;
  };
  const agent = await makeOrgMember(fx.org.id, "AGENT");
  const auditor = await makeOrgMember(fx.org.id, "AUDITOR");
  const viewer = await makeEventMember(fx.event.id, "VIEWER");
  const operator = await makeEventMember(fx.event.id, "OPERATOR");

  // Autre évènement de la même organisation, et autre organisation.
  const otherEvent = await makeEvent(fx.org.id);
  const otherOrg = await makeOrg();
  const foreignEvent = await makeEvent(otherOrg.id);
  const sameOrgOtherEvent = { org: fx.org, event: otherEvent, owner: fx.owner };
  const foreignOrg = { org: otherOrg, event: foreignEvent, owner: fx.owner };
  const otherCategory = await makeCategory(otherEvent.id);
  const foreignRegistration = await makeRegistration(otherEvent.id, otherCategory.id, "APPROVED");
  const staffPrinter = await makeStaff("STAFF_PRINTER");

  const scope = (requestId: string) => ({ orgId: fx.org.id, eventId: fx.event.id, requestId });
  return {
    fx, order, agent, auditor, viewer, operator, staffPrinter, scope,
    otherEventOrder: () => order({}, sameOrgOtherEvent as never),
    foreignOrgOrder: () => order({}, foreignOrg as never),
    foreignRegistration,
  };
}
