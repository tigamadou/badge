import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

import * as orgRoute from "../route";
import * as activityRoute from "../activity/route";
import * as settingsBadgeRoute from "../settings/badge/route";
import * as checkoutRoute from "../subscription/checkout/route";
import * as templatesRoute from "../templates/route";
import * as templateRoute from "../templates/[id]/route";
import * as uploadRoute from "../upload/route";
import * as eventsRoute from "../events/route";
import * as archiveRoute from "../events/[eventId]/archive/route";
import * as restoreRoute from "../events/[eventId]/restore/route";

seedFactories(2301);

type Role = "OWNER" | "MANAGER" | "AUDITOR" | "AGENT";
type Handler = (req: NextRequest, ctx: never) => Promise<Response>;

// Une ligne par route : la permission est portée par les rôles système listés dans `allowed`.
const ROUTES: Array<{
  name: string;
  handler: Handler;
  method: string;
  path: string;
  permission: string;
  allowed: Role[];
  denied: Role[];
  staffObserver: "allow" | "deny";
}> = [
  { name: "GET /", handler: orgRoute.GET, method: "GET", path: "", permission: "org.read", allowed: ["AGENT", "AUDITOR"], denied: [], staffObserver: "allow" },
  { name: "PATCH /", handler: orgRoute.PATCH, method: "PATCH", path: "", permission: "org.update", allowed: ["OWNER"], denied: ["MANAGER", "AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "GET /activity", handler: activityRoute.GET, method: "GET", path: "/activity", permission: "org.activity.read", allowed: ["AUDITOR"], denied: ["AGENT"], staffObserver: "allow" },
  { name: "PATCH /settings/badge", handler: settingsBadgeRoute.PATCH, method: "PATCH", path: "/settings/badge", permission: "org.badge_settings.update", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "POST /subscription/checkout", handler: checkoutRoute.POST, method: "POST", path: "/subscription/checkout", permission: "billing.subscription.pay", allowed: ["OWNER"], denied: ["MANAGER", "AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "GET /templates", handler: templatesRoute.GET, method: "GET", path: "/templates", permission: "org.templates.read", allowed: ["AUDITOR"], denied: ["AGENT"], staffObserver: "allow" },
  { name: "POST /templates", handler: templatesRoute.POST, method: "POST", path: "/templates", permission: "org.templates.manage", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "PATCH /templates/[id]", handler: templateRoute.PATCH, method: "PATCH", path: "/templates/inconnu", permission: "org.templates.manage", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "DELETE /templates/[id]", handler: templateRoute.DELETE, method: "DELETE", path: "/templates/inconnu", permission: "org.templates.manage", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "POST /upload", handler: uploadRoute.POST, method: "POST", path: "/upload", permission: "org.upload", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "GET /events", handler: eventsRoute.GET, method: "GET", path: "/events", permission: "org.events.list", allowed: ["AGENT"], denied: [], staffObserver: "allow" },
  { name: "POST /events", handler: eventsRoute.POST, method: "POST", path: "/events", permission: "org.events.create", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "POST /events/[id]/archive", handler: archiveRoute.POST, method: "POST", path: "/events/inconnu/archive", permission: "org.events.archive", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
  { name: "POST /events/[id]/restore", handler: restoreRoute.POST, method: "POST", path: "/events/inconnu/restore", permission: "org.events.archive", allowed: ["MANAGER"], denied: ["AUDITOR", "AGENT"], staffObserver: "deny" },
];

async function call(
  r: (typeof ROUTES)[number],
  orgId: string,
  user: { id: string; email: string; name: string; isStaff?: boolean } | null,
) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff: user.isStaff ?? false } } : null) as never,
  );
  const hasBody = r.method !== "GET" && r.method !== "DELETE";
  const req = new NextRequest(`http://localhost/api/org/${orgId}${r.path}`, {
    method: r.method,
    ...(hasBody ? { body: "{}", headers: { "content-type": "application/json" } } : {}),
  });
  const segments = r.path.split("/").filter(Boolean);
  const params: Record<string, string> = { orgId };
  if (segments[0] === "templates") params.id = segments[1];
  if (segments[0] === "events") params.eventId = segments[1];
  return r.handler(req, { params: Promise.resolve(params) } as never);
}

describe.each(ROUTES)("$name ($permission)", (r) => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    const org = await makeOrg();
    expect((await call(r, org.id, null)).status).toBe(401);
  });

  it("403 pour un utilisateur sans appartenance", async () => {
    const org = await makeOrg();
    expect((await call(r, org.id, await makeUser())).status).toBe(403);
  });

  it.each(r.allowed)("autorisé pour %s", async (role) => {
    const org = await makeOrg();
    const res = await call(r, org.id, await makeOrgMember(org.id, role));
    expect([401, 403]).not.toContain(res.status);
  });

  it.each(r.denied.length ? r.denied : [null])("refusé (403) pour %s", async (role) => {
    if (!role) return;
    const org = await makeOrg();
    expect((await call(r, org.id, await makeOrgMember(org.id, role))).status).toBe(403);
  });

  it("membre d'une autre organisation : 403", async () => {
    const org = await makeOrg();
    const other = await makeOrg();
    expect((await call(r, org.id, await makeOrgMember(other.id, "OWNER"))).status).toBe(403);
  });

  it(`Observateur plateforme : ${r.staffObserver === "allow" ? "lecture permise" : "écriture refusée (403)"}`, async () => {
    const org = await makeOrg();
    const staff = await makeStaff("STAFF_OBSERVER");
    const res = await call(r, org.id, { ...staff, isStaff: true });
    if (r.staffObserver === "allow") expect([401, 403]).not.toContain(res.status);
    else expect(res.status).toBe(403);
  });
});
