import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories,
} from "@/test/factories";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES, type Permission, type SystemRoleKey } from "@/lib/permissions";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import * as eventRoute from "../route";
import * as settingsRoute from "../settings/route";
import * as settingsBadgeRoute from "../settings/badge/route";
import * as uploadRoute from "../upload/route";
import * as activityRoute from "../activity/route";
import * as blockedEmailsRoute from "../blocked-emails/route";
import * as blockedEmailRoute from "../blocked-emails/[id]/route";
import * as blockedDocsRoute from "../blocked-documents/route";
import * as blockedDocRoute from "../blocked-documents/[id]/route";
import * as categoriesRoute from "../categories/route";
import * as categoryRoute from "../categories/[id]/route";
import * as importTemplatesRoute from "../categories/import-templates/route";
import * as registrationsRoute from "../registrations/route";
import * as exportRoute from "../registrations/export/route";
import * as overviewRoute from "../registrations/overview/route";
import * as registrationRoute from "../registrations/[regId]/route";
import * as approveRoute from "../registrations/[regId]/approve/route";
import * as rejectRoute from "../registrations/[regId]/reject/route";
import * as checkinRoute from "../registrations/[regId]/checkin/route";
import * as printRoute from "../registrations/[regId]/print/route";
import * as allAccessRoute from "../registrations/[regId]/all-access/route";
import * as blockEmailRoute from "../registrations/[regId]/block-email/route";
import * as blockDocumentRoute from "../registrations/[regId]/block-document/route";
import * as duplicatesRoute from "../registrations/[regId]/duplicates/route";
import * as scanVerifyRoute from "../scan/verify/route";

seedFactories(2302);

type Handler = (req: NextRequest, ctx: never) => Promise<Response>;
type Row = { name: string; handler: Handler; method: string; path: string; permissions: Permission[] };

const reg = "/registrations/inconnu";
const ROWS: Row[] = [
  { name: "GET event", handler: eventRoute.GET, method: "GET", path: "", permissions: ["event.read.detailed"] },
  { name: "PATCH event", handler: eventRoute.PATCH, method: "PATCH", path: "", permissions: ["event.update"] },
  { name: "GET settings", handler: settingsRoute.GET, method: "GET", path: "/settings", permissions: ["event.settings.update"] },
  { name: "PATCH settings", handler: settingsRoute.PATCH, method: "PATCH", path: "/settings", permissions: ["event.settings.update"] },
  { name: "PATCH settings/badge", handler: settingsBadgeRoute.PATCH, method: "PATCH", path: "/settings/badge", permissions: ["event.settings.update"] },
  { name: "POST upload", handler: uploadRoute.POST, method: "POST", path: "/upload", permissions: ["event.update"] },
  { name: "GET activity", handler: activityRoute.GET, method: "GET", path: "/activity", permissions: ["event.activity.read", "scan.history.read"] },
  { name: "GET blocked-emails", handler: blockedEmailsRoute.GET, method: "GET", path: "/blocked-emails", permissions: ["registration.block"] },
  { name: "POST blocked-emails", handler: blockedEmailsRoute.POST, method: "POST", path: "/blocked-emails", permissions: ["registration.block"] },
  { name: "DELETE blocked-emails/[id]", handler: blockedEmailRoute.DELETE, method: "DELETE", path: "/blocked-emails/inconnu", permissions: ["registration.block"] },
  { name: "GET blocked-documents", handler: blockedDocsRoute.GET, method: "GET", path: "/blocked-documents", permissions: ["registration.block"] },
  { name: "POST blocked-documents", handler: blockedDocsRoute.POST, method: "POST", path: "/blocked-documents", permissions: ["registration.block"] },
  { name: "DELETE blocked-documents/[id]", handler: blockedDocRoute.DELETE, method: "DELETE", path: "/blocked-documents/inconnu", permissions: ["registration.block"] },
  { name: "GET categories", handler: categoriesRoute.GET, method: "GET", path: "/categories", permissions: ["event.read.detailed"] },
  { name: "POST categories", handler: categoriesRoute.POST, method: "POST", path: "/categories", permissions: ["event.categories.manage"] },
  { name: "PATCH categories/[id]", handler: categoryRoute.PATCH, method: "PATCH", path: "/categories/inconnu", permissions: ["event.categories.manage"] },
  { name: "DELETE categories/[id]", handler: categoryRoute.DELETE, method: "DELETE", path: "/categories/inconnu", permissions: ["event.categories.manage"] },
  { name: "POST categories/import-templates", handler: importTemplatesRoute.POST, method: "POST", path: "/categories/import-templates", permissions: ["event.categories.manage"] },
  { name: "GET registrations", handler: registrationsRoute.GET, method: "GET", path: "/registrations", permissions: ["event.read.detailed"] },
  { name: "POST registrations", handler: registrationsRoute.POST, method: "POST", path: "/registrations", permissions: ["registration.create"] },
  { name: "GET registrations/export", handler: exportRoute.GET, method: "GET", path: "/registrations/export", permissions: ["registration.export"] },
  { name: "GET registrations/overview", handler: overviewRoute.GET, method: "GET", path: "/registrations/overview", permissions: ["event.read.aggregated"] },
  { name: "GET registrations/[regId]", handler: registrationRoute.GET, method: "GET", path: reg, permissions: ["event.read.detailed"] },
  { name: "PATCH registrations/[regId]", handler: registrationRoute.PATCH, method: "PATCH", path: reg, permissions: ["registration.update"] },
  { name: "DELETE registrations/[regId]", handler: registrationRoute.DELETE, method: "DELETE", path: reg, permissions: ["registration.delete"] },
  { name: "POST approve", handler: approveRoute.POST, method: "POST", path: `${reg}/approve`, permissions: ["registration.approve"] },
  { name: "POST reject", handler: rejectRoute.POST, method: "POST", path: `${reg}/reject`, permissions: ["registration.approve"] },
  { name: "POST checkin", handler: checkinRoute.POST, method: "POST", path: `${reg}/checkin`, permissions: ["scan.check-in"] },
  { name: "POST print", handler: printRoute.POST, method: "POST", path: `${reg}/print`, permissions: ["badge.print"] },
  { name: "POST all-access", handler: allAccessRoute.POST, method: "POST", path: `${reg}/all-access`, permissions: ["registration.all_access"] },
  { name: "POST block-email", handler: blockEmailRoute.POST, method: "POST", path: `${reg}/block-email`, permissions: ["registration.block"] },
  { name: "POST block-document", handler: blockDocumentRoute.POST, method: "POST", path: `${reg}/block-document`, permissions: ["registration.block"] },
  { name: "GET duplicates", handler: duplicatesRoute.GET, method: "GET", path: `${reg}/duplicates`, permissions: ["registration.block"] },
  { name: "POST scan/verify", handler: scanVerifyRoute.POST, method: "POST", path: "/scan/verify", permissions: ["scan.check-in"] },
];

// Rôles portés par la membership de l'organisation (« org ») ou de l'évènement (« event »), ou par la plateforme.
const HOLDERS: Array<{ key: SystemRoleKey; via: "org" | "event" | "staff" }> = [
  { key: "OWNER", via: "org" }, { key: "MANAGER", via: "org" }, { key: "AUDITOR", via: "org" }, { key: "AGENT", via: "org" },
  { key: "ADMIN", via: "event" }, { key: "OPERATOR", via: "event" }, { key: "PRINTER", via: "event" }, { key: "VIEWER", via: "event" },
  { key: "STAFF_ADMIN", via: "staff" }, { key: "STAFF_SUPPORT", via: "staff" }, { key: "STAFF_OBSERVER", via: "staff" },
];

type Actor = { id: string; email: string; name: string; isStaff: boolean };

async function actorFor(h: (typeof HOLDERS)[number], orgId: string, eventId: string): Promise<Actor> {
  if (h.via === "org") return { ...(await makeOrgMember(orgId, h.key as never)), isStaff: false };
  if (h.via === "event") return { ...(await makeEventMember(eventId, h.key as never)), isStaff: false };
  return { ...(await makeStaff(h.key as never)), isStaff: true };
}

async function call(r: Row, orgId: string, eventId: string, actor: Actor | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    (actor ? { user: { id: actor.id, email: actor.email, name: actor.name, isStaff: actor.isStaff } } : null) as never,
  );
  const hasBody = r.method !== "GET" && r.method !== "DELETE";
  const req = new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}${r.path}`, {
    method: r.method,
    ...(hasBody ? { body: "{}", headers: { "content-type": "application/json" } } : {}),
  });
  const segments = r.path.split("/").filter(Boolean);
  const params: Record<string, string> = { orgId, eventId };
  if (segments[0] === "registrations" && segments[1] && segments[1] !== "export" && segments[1] !== "overview") params.regId = segments[1];
  if (["categories", "blocked-emails", "blocked-documents"].includes(segments[0]) && segments[1] && segments[1] !== "import-templates") params.id = segments[1];
  return r.handler(req, { params: Promise.resolve(params) } as never);
}

async function denied(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  return (await res.clone().json().catch(() => null))?.error === "PERMISSION_DENIED";
}

async function scene() {
  const org = await makeOrg();
  return { org, event: await makeEvent(org.id) };
}

describe.each(ROWS)("$name", (r) => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    const { org, event } = await scene();
    expect((await call(r, org.id, event.id, null)).status).toBe(401);
  });

  it("refusé à un utilisateur sans appartenance", async () => {
    const { org, event } = await scene();
    const u = await makeUser();
    expect(await denied(await call(r, org.id, event.id, { ...u, isStaff: false }))).toBe(true);
  });

  it("chaque rôle système est accepté ou refusé selon sa permission", async () => {
    const { org, event } = await scene();
    for (const h of HOLDERS) {
      const held = r.permissions.some((p) => SYSTEM_ROLES[h.key].permissions.includes(p));
      const res = await call(r, org.id, event.id, await actorFor(h, org.id, event.id));
      expect({ role: h.key, denied: await denied(res), status: res.status }).toMatchObject({
        role: h.key,
        denied: !held,
      });
      if (held) expect(res.status).not.toBe(401);
    }
  });

  it("membre d'un autre évènement de la même organisation : refusé", async () => {
    const { org, event } = await scene();
    const other = await makeEvent(org.id);
    const u = await makeEventMember(other.id, "ADMIN");
    expect(await denied(await call(r, org.id, event.id, { ...u, isStaff: false }))).toBe(true);
  });
});

describe("cas métier explicites (plan lot 2b)", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("OPERATOR : 403 sur création, modification, suppression et export des inscriptions", async () => {
    const { org, event } = await scene();
    const op = { ...(await makeEventMember(event.id, "OPERATOR")), isStaff: false };
    for (const name of ["POST registrations", "PATCH registrations/[regId]", "DELETE registrations/[regId]", "GET registrations/export"]) {
      const r = ROWS.find((x) => x.name === name)!;
      expect(await denied(await call(r, org.id, event.id, op)), name).toBe(true);
    }
  });

  it("VIEWER : 200 sur overview, 403 sur la liste des inscriptions", async () => {
    const { org, event } = await scene();
    const v = { ...(await makeEventMember(event.id, "VIEWER")), isStaff: false };
    expect((await call(ROWS.find((x) => x.name === "GET registrations/overview")!, org.id, event.id, v)).status).toBe(200);
    expect(await denied(await call(ROWS.find((x) => x.name === "GET registrations")!, org.id, event.id, v))).toBe(true);
  });

  it("PRINTER : imprime (pas 403) mais n'approuve pas", async () => {
    const { org, event } = await scene();
    const p = { ...(await makeEventMember(event.id, "PRINTER")), isStaff: false };
    expect(await denied(await call(ROWS.find((x) => x.name === "POST print")!, org.id, event.id, p))).toBe(false);
    expect(await denied(await call(ROWS.find((x) => x.name === "POST approve")!, org.id, event.id, p))).toBe(true);
  });

  it("AUDITOR d'organisation : lecture agrégée 200, liste des inscriptions refusée", async () => {
    const { org, event } = await scene();
    const a = { ...(await makeOrgMember(org.id, "AUDITOR")), isStaff: false };
    expect((await call(ROWS.find((x) => x.name === "GET registrations/overview")!, org.id, event.id, a)).status).toBe(200);
    expect(await denied(await call(ROWS.find((x) => x.name === "GET registrations")!, org.id, event.id, a))).toBe(true);
  });

  it("staff : l'Observateur lit les inscriptions mais ne modifie pas ; le Support approuve", async () => {
    const { org, event } = await scene();
    const obs = { ...(await makeStaff("STAFF_OBSERVER")), isStaff: true };
    expect((await call(ROWS.find((x) => x.name === "GET registrations")!, org.id, event.id, obs)).status).toBe(200);
    expect(await denied(await call(ROWS.find((x) => x.name === "PATCH registrations/[regId]")!, org.id, event.id, obs))).toBe(true);
    const sup = { ...(await makeStaff("STAFF_SUPPORT")), isStaff: true };
    expect(await denied(await call(ROWS.find((x) => x.name === "POST approve")!, org.id, event.id, sup))).toBe(false);
  });

  it("PATCH settings/badge : un VIEWER est refusé par la garde (plus de contrôle explicite)", async () => {
    const { org, event } = await scene();
    const v = { ...(await makeEventMember(event.id, "VIEWER")), isStaff: false };
    const res = await call(ROWS.find((x) => x.name === "PATCH settings/badge")!, org.id, event.id, v);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PERMISSION_DENIED");
  });
});

describe("GET activity : filtrage selon la permission", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());
  const row = ROWS.find((x) => x.name === "GET activity")!;

  async function seedLogs(orgId: string, eventId: string, scannerId: string, otherId: string) {
    await prisma.activityLog.createMany({
      data: [
        { type: "BADGE_SCANNED", userId: scannerId, orgId, eventId },
        { type: "BADGE_SCANNED", userId: otherId, orgId, eventId },
        { type: "EVENT_UPDATED", userId: otherId, orgId, eventId },
      ],
    });
  }

  it("ADMIN voit tous les types ; l'AGENT ne voit que ses scans ; le VIEWER est refusé ; l'Observateur voit tout", async () => {
    const { org, event } = await scene();
    const admin = { ...(await makeEventMember(event.id, "ADMIN")), isStaff: false };
    const agent = { ...(await makeOrgMember(org.id, "AGENT")), isStaff: false };
    await seedLogs(org.id, event.id, agent.id, admin.id);

    const total = async (a: Actor) => (await (await call(row, org.id, event.id, a)).json()).total;
    expect(await total(admin)).toBe(3);
    expect(await total(agent)).toBe(1);

    const viewer = { ...(await makeEventMember(event.id, "VIEWER")), isStaff: false };
    expect(await denied(await call(row, org.id, event.id, viewer))).toBe(true);

    const obs = { ...(await makeStaff("STAFF_OBSERVER")), isStaff: true };
    expect(await total(obs)).toBe(3);
  });

  it("OPERATOR : seulement ses propres scans", async () => {
    const { org, event } = await scene();
    const op = { ...(await makeEventMember(event.id, "OPERATOR")), isStaff: false };
    const other = await makeUser();
    await seedLogs(org.id, event.id, op.id, other.id);
    expect((await (await call(row, org.id, event.id, op)).json()).total).toBe(1);
  });
});
