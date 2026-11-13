// Matrice de refus : pour chaque route plateforme, les rôles système autorisés d'après la spec 37.
// Épingle le catalogue contre la spec et exerce toutes les branches de refus.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { makeStaff, makeUser } from "@/test/factories";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { isPermission, systemRolePermissions, type Permission } from "@/lib/permissions";

// La matrice enchaîne des centaines de requêtes sur la vraie base : marge pour les machines chargées.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffKey = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_PRINTER" | "STAFF_OBSERVER";
const ALL: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_PRINTER", "STAFF_OBSERVER"];
const SA: StaffKey[] = ["SUPER_ADMIN"];
const SA_AD: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN"];
const READ: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"];
const VALIDATE: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT"];
const PRINT_READ: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_PRINTER", "STAFF_OBSERVER"];
const PRINT_WORK: StaffKey[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_PRINTER"];
export const GROUPS = { ALL, SA, SA_AD, READ, VALIDATE, PRINT_READ, PRINT_WORK };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Row = {
  route: string;
  method: Method;
  load: () => Promise<Partial<Record<Method, Handler>>>;
  params?: Record<string, string>;
  /** Corps JSON de la requête (défaut : objet vide). */
  body?: unknown;
  /** Chaîne de requête (ex. "?context=print-product"). */
  query?: string;
  /** Permission attendue du catalogue (épinglée contre les rôles système). */
  permission: Permission;
  allowed: StaffKey[];
};

// Chaque tâche du lot ajoute ses lignes ici.
const ROWS: Row[] = [
  {
    // Ligne d'auto-contrôle de la matrice elle-même (handler local gardé par withStaffAuth).
    route: "/api/platform/plans",
    method: "GET",
    load: async () => ({
      GET: withStaffAuth(async () => NextResponse.json({ ok: true }), { permission: "plans.read" }) as Handler,
    }),
    permission: "plans.read",
    allowed: READ,
  },
  {
    route: "/api/platform/organizations",
    method: "GET",
    load: () => import("@/app/api/platform/organizations/route") as never,
    permission: "organizations.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/organizations",
    method: "POST",
    load: () => import("@/app/api/platform/organizations/route") as never,
    permission: "organizations.create",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/organizations/ghost",
    method: "GET",
    load: () => import("@/app/api/platform/organizations/[orgId]/route") as never,
    permission: "organizations.read",
    allowed: GROUPS.READ,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/organizations/ghost",
    method: "PATCH",
    load: () => import("@/app/api/platform/organizations/[orgId]/route") as never,
    permission: "organizations.update",
    allowed: GROUPS.SA_AD,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/organizations/ghost",
    method: "DELETE",
    load: () => import("@/app/api/platform/organizations/[orgId]/route") as never,
    permission: "organizations.delete",
    allowed: GROUPS.SA,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/organizations/ghost/archive",
    method: "POST",
    load: () => import("@/app/api/platform/organizations/[orgId]/archive/route") as never,
    permission: "organizations.archive",
    allowed: GROUPS.SA_AD,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/organizations/ghost/restore",
    method: "POST",
    load: () => import("@/app/api/platform/organizations/[orgId]/restore/route") as never,
    permission: "organizations.archive",
    allowed: GROUPS.SA_AD,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/organizations/ghost/subscription",
    method: "PUT",
    load: () => import("@/app/api/platform/organizations/[orgId]/subscription/route") as never,
    permission: "subscriptions.update",
    allowed: GROUPS.SA_AD,
    params: { orgId: "ghost" },
  },
  {
    route: "/api/platform/plans",
    method: "GET",
    load: () => import("@/app/api/platform/plans/route") as never,
    permission: "plans.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/plans",
    method: "POST",
    load: () => import("@/app/api/platform/plans/route") as never,
    permission: "plans.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/plans/ghost",
    method: "PATCH",
    load: () => import("@/app/api/platform/plans/[planId]/route") as never,
    permission: "plans.manage",
    allowed: GROUPS.SA_AD,
    params: { planId: "ghost" },
  },
  {
    route: "/api/platform/profiles",
    method: "GET",
    load: () => import("@/app/api/platform/profiles/route") as never,
    permission: "profiles.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/profiles/ghost",
    method: "GET",
    load: () => import("@/app/api/platform/profiles/[userId]/route") as never,
    permission: "profiles.read",
    allowed: GROUPS.READ,
    params: { userId: "ghost" },
  },
  {
    route: "/api/platform/profiles/ghost/approve",
    method: "POST",
    load: () => import("@/app/api/platform/profiles/[userId]/approve/route") as never,
    permission: "profiles.review",
    allowed: GROUPS.VALIDATE,
    params: { userId: "ghost" },
  },
  {
    route: "/api/platform/profiles/ghost/reject",
    method: "POST",
    load: () => import("@/app/api/platform/profiles/[userId]/reject/route") as never,
    permission: "profiles.review",
    allowed: GROUPS.VALIDATE,
    params: { userId: "ghost" },
  },
  {
    route: "/api/platform/blocked-emails",
    method: "GET",
    load: () => import("@/app/api/platform/blocked-emails/route") as never,
    permission: "blocklist.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/blocked-emails",
    method: "POST",
    load: () => import("@/app/api/platform/blocked-emails/route") as never,
    permission: "blocklist.manage",
    allowed: GROUPS.VALIDATE,
  },
  {
    route: "/api/platform/blocked-emails/ghost",
    method: "DELETE",
    load: () => import("@/app/api/platform/blocked-emails/[id]/route") as never,
    permission: "blocklist.manage",
    allowed: GROUPS.VALIDATE,
    params: { id: "ghost" },
  },
  {
    route: "/api/platform/blocked-documents",
    method: "GET",
    load: () => import("@/app/api/platform/blocked-documents/route") as never,
    permission: "blocklist.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/blocked-documents",
    method: "POST",
    load: () => import("@/app/api/platform/blocked-documents/route") as never,
    permission: "blocklist.manage",
    allowed: GROUPS.VALIDATE,
  },
  {
    route: "/api/platform/blocked-documents/ghost",
    method: "DELETE",
    load: () => import("@/app/api/platform/blocked-documents/[id]/route") as never,
    permission: "blocklist.manage",
    allowed: GROUPS.VALIDATE,
    params: { id: "ghost" },
  },
  {
    route: "/api/platform/settings",
    method: "GET",
    load: () => import("@/app/api/platform/settings/route") as never,
    permission: "settings.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/settings",
    method: "PATCH",
    load: () => import("@/app/api/platform/settings/route") as never,
    permission: "settings.update",
    allowed: GROUPS.SA_AD,
    body: { smtpHost: "smtp.matrix.test" },
  },
  {
    route: "/api/platform/settings/badge",
    method: "PATCH",
    load: () => import("@/app/api/platform/settings/badge/route") as never,
    permission: "settings.badge_template.update",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/settings/onsite-print",
    method: "PATCH",
    load: () => import("@/app/api/platform/settings/onsite-print/route") as never,
    permission: "settings.onsite_print.update",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/settings/test-smtp",
    method: "POST",
    load: () => import("@/app/api/platform/settings/test-smtp/route") as never,
    permission: "settings.smtp.test",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/rejection-reasons",
    method: "GET",
    load: () => import("@/app/api/platform/rejection-reasons/route") as never,
    permission: "rejection_reasons.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/rejection-reasons",
    method: "POST",
    load: () => import("@/app/api/platform/rejection-reasons/route") as never,
    permission: "rejection_reasons.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/rejection-reasons/ghost",
    method: "PATCH",
    load: () => import("@/app/api/platform/rejection-reasons/[id]/route") as never,
    permission: "rejection_reasons.manage",
    allowed: GROUPS.SA_AD,
    params: { id: "ghost" },
  },
  {
    route: "/api/platform/rejection-reasons/ghost",
    method: "DELETE",
    load: () => import("@/app/api/platform/rejection-reasons/[id]/route") as never,
    permission: "rejection_reasons.manage",
    allowed: GROUPS.SA_AD,
    params: { id: "ghost" },
  },
  {
    route: "/api/platform/badge-templates",
    method: "GET",
    load: () => import("@/app/api/platform/badge-templates/route") as never,
    permission: "badge_templates.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/badge-templates",
    method: "POST",
    load: () => import("@/app/api/platform/badge-templates/route") as never,
    permission: "badge_templates.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/badge-templates/ghost",
    method: "PATCH",
    load: () => import("@/app/api/platform/badge-templates/[id]/route") as never,
    permission: "badge_templates.manage",
    allowed: GROUPS.SA_AD,
    params: { id: "ghost" },
  },
  {
    route: "/api/platform/badge-templates/inspect",
    method: "POST",
    load: () => import("@/app/api/platform/badge-templates/inspect/route") as never,
    permission: "badge_templates.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/jobs",
    method: "GET",
    load: () => import("@/app/api/platform/jobs/route") as never,
    permission: "email_jobs.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/jobs/ghost",
    method: "GET",
    load: () => import("@/app/api/platform/jobs/[jobId]/route") as never,
    permission: "email_jobs.read",
    allowed: GROUPS.READ,
    params: { jobId: "ghost" },
  },
  {
    route: "/api/platform/jobs/ghost/cancel",
    method: "POST",
    load: () => import("@/app/api/platform/jobs/[jobId]/cancel/route") as never,
    permission: "email_jobs.manage",
    allowed: GROUPS.SA_AD,
    params: { jobId: "ghost" },
  },
  {
    route: "/api/platform/jobs/ghost/retry",
    method: "POST",
    load: () => import("@/app/api/platform/jobs/[jobId]/retry/route") as never,
    permission: "email_jobs.manage",
    allowed: GROUPS.SA_AD,
    params: { jobId: "ghost" },
  },
  {
    route: "/api/platform/activity",
    method: "GET",
    load: () => import("@/app/api/platform/activity/route") as never,
    permission: "activity.read",
    allowed: GROUPS.READ,
  },
  {
    route: "/api/platform/upload",
    method: "POST",
    load: () => import("@/app/api/platform/upload/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    query: "?context=print-product",
  },
  {
    route: "/api/platform/upload",
    method: "POST",
    load: () => import("@/app/api/platform/upload/route") as never,
    permission: "print.requests.messages.send",
    allowed: GROUPS.PRINT_WORK,
    query: "?context=print-request",
  },
  {
    route: "/platform/payments/ghost/receipt",
    method: "GET",
    load: () => import("@/app/platform/payments/[paymentId]/receipt/route") as never,
    permission: "payments.read",
    allowed: GROUPS.READ,
    params: { paymentId: "ghost" },
  },
  {
    route: "/api/platform/print/requests",
    method: "GET",
    load: () => import("@/app/api/platform/print/requests/route") as never,
    permission: "print.requests.read",
    allowed: GROUPS.PRINT_READ,
  },
  {
    route: "/api/platform/print/requests/[requestId]",
    method: "GET",
    load: () => import("@/app/api/platform/print/requests/[requestId]/route") as never,
    permission: "print.requests.read",
    allowed: GROUPS.PRINT_READ,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/items",
    method: "GET",
    load: () => import("@/app/api/platform/print/requests/[requestId]/items/route") as never,
    permission: "print.requests.read",
    allowed: GROUPS.PRINT_READ,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/messages",
    method: "GET",
    load: () => import("@/app/api/platform/print/requests/[requestId]/messages/route") as never,
    permission: "print.requests.read",
    allowed: GROUPS.PRINT_READ,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/messages",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/messages/route") as never,
    permission: "print.requests.messages.send",
    allowed: GROUPS.PRINT_WORK,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/reject",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/reject/route") as never,
    permission: "print.requests.reject",
    allowed: GROUPS.PRINT_WORK,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/reopen",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/reopen/route") as never,
    permission: "print.requests.reopen",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/send-quote",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/send-quote/route") as never,
    permission: "print.requests.quote.send",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/lines",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/lines/route") as never,
    permission: "print.requests.quote.edit",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/lines/[lineId]",
    method: "PATCH",
    load: () => import("@/app/api/platform/print/requests/[requestId]/lines/[lineId]/route") as never,
    permission: "print.requests.quote.edit",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue", lineId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/lines/[lineId]",
    method: "DELETE",
    load: () => import("@/app/api/platform/print/requests/[requestId]/lines/[lineId]/route") as never,
    permission: "print.requests.quote.edit",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue", lineId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/mark-paid",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/mark-paid/route") as never,
    permission: "print.requests.mark_paid",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/credit",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/credit/route") as never,
    permission: "print.requests.credit.apply",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/status",
    method: "POST",
    load: () => import("@/app/api/platform/print/requests/[requestId]/status/route") as never,
    permission: "print.requests.advance",
    allowed: GROUPS.PRINT_WORK,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/requests/[requestId]/onsite/margin",
    method: "PATCH",
    load: () => import("@/app/api/platform/print/requests/[requestId]/onsite/margin/route") as never,
    permission: "print.onsite.margin.update",
    allowed: GROUPS.SA_AD,
    params: { requestId: "inconnue" },
  },
  {
    route: "/api/platform/print/layouts",
    method: "GET",
    load: () => import("@/app/api/platform/print/layouts/route") as never,
    permission: "print.layouts.read",
    allowed: GROUPS.PRINT_READ,
  },
  {
    route: "/api/platform/print/layouts",
    method: "POST",
    load: () => import("@/app/api/platform/print/layouts/route") as never,
    permission: "print.layouts.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/print/layouts/[layoutId]",
    method: "PATCH",
    load: () => import("@/app/api/platform/print/layouts/[layoutId]/route") as never,
    permission: "print.layouts.manage",
    allowed: GROUPS.SA_AD,
    params: { layoutId: "inconnu" },
  },
  {
    route: "/api/platform/print/layouts/[layoutId]",
    method: "DELETE",
    load: () => import("@/app/api/platform/print/layouts/[layoutId]/route") as never,
    permission: "print.layouts.manage",
    allowed: GROUPS.SA_AD,
    params: { layoutId: "inconnu" },
  },
  {
    route: "/api/platform/print/products",
    method: "POST",
    load: () => import("@/app/api/platform/print/products/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
  },
  {
    route: "/api/platform/print/products/[productId]",
    method: "PATCH",
    load: () => import("@/app/api/platform/print/products/[productId]/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    params: { productId: "inconnu" },
  },
  {
    route: "/api/platform/print/products/[productId]",
    method: "DELETE",
    load: () => import("@/app/api/platform/print/products/[productId]/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    params: { productId: "inconnu" },
  },
  {
    route: "/api/platform/print/products/[productId]/images",
    method: "PUT",
    load: () => import("@/app/api/platform/print/products/[productId]/images/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    params: { productId: "inconnu" },
  },
  {
    route: "/api/platform/print/products/[productId]/options",
    method: "PUT",
    load: () => import("@/app/api/platform/print/products/[productId]/options/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    params: { productId: "inconnu" },
  },
  {
    route: "/api/platform/print/products/[productId]/tiers",
    method: "PUT",
    load: () => import("@/app/api/platform/print/products/[productId]/tiers/route") as never,
    permission: "print.catalog.manage",
    allowed: GROUPS.SA_AD,
    params: { productId: "inconnu" },
  },
  {
    route: "/api/platform/print/sheets",
    method: "GET",
    load: () => import("@/app/api/platform/print/sheets/route") as never,
    permission: "print.sheets.read",
    allowed: GROUPS.PRINT_WORK,
  },
  {
    route: "/api/platform/print/sheets",
    method: "POST",
    load: () => import("@/app/api/platform/print/sheets/route") as never,
    permission: "print.sheets.generate",
    allowed: GROUPS.PRINT_WORK,
  },
  {
    route: "/api/platform/print/sheets/[generationId]",
    method: "GET",
    load: () => import("@/app/api/platform/print/sheets/[generationId]/route") as never,
    permission: "print.sheets.read",
    allowed: GROUPS.PRINT_WORK,
    params: { generationId: "inconnue" },
  },
  {
    route: "/api/platform/print/sheets/orders",
    method: "GET",
    load: () => import("@/app/api/platform/print/sheets/orders/route") as never,
    permission: "print.sheets.read",
    allowed: GROUPS.PRINT_WORK,
  },
  {
    route: "/api/platform/print/sheets/options",
    method: "GET",
    load: () => import("@/app/api/platform/print/sheets/options/route") as never,
    permission: "print.sheets.generate",
    allowed: GROUPS.PRINT_WORK,
  },
  // ROWS-END
];

function request(row: Row) {
  const init: { method: Method; body?: string; headers?: Record<string, string> } = { method: row.method };
  if (row.method !== "GET") {
    init.body = JSON.stringify(row.body ?? {});
    init.headers = { "content-type": "application/json" };
  }
  return new NextRequest(`http://localhost${row.route}${row.query ?? ""}`, init);
}

function session(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, isStaff: true } } as never);
}

describe("matrice de permissions de l'espace plateforme", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("chaque ligne désigne une clé du catalogue et les rôles système la portent comme la spec", () => {
    for (const row of ROWS) {
      expect(isPermission(row.permission), `${row.method} ${row.route}`).toBe(true);
      for (const key of ALL) {
        expect(
          systemRolePermissions(key).has(row.permission),
          `${row.method} ${row.route} (${row.permission}) pour ${key}`,
        ).toBe(row.allowed.includes(key));
      }
    }
  });

  it.each(ROWS.map((r) => [`${r.method} ${r.route}`, r] as const))("%s", async (_label, row) => {
    const handler = (await row.load())[row.method];
    expect(handler, "handler exporté").toBeTypeOf("function");
    const call = () => handler!(request(row), { params: Promise.resolve(row.params ?? {}) });

    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await call()).status, "sans session").toBe(401);

    const plain = await makeUser();
    session(plain.id);
    expect((await call()).status, "non staff").toBe(403);

    for (const key of ALL) {
      const staff = await makeStaff(key);
      session(staff.id);
      const status = (await call()).status;
      if (row.allowed.includes(key)) {
        expect([401, 403], `${key} doit passer la garde (reçu ${status})`).not.toContain(status);
      } else {
        expect(status, `${key} doit être refusé`).toBe(403);
      }
    }
  });
});
