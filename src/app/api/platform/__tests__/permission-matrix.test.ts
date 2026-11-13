// Matrice de refus : pour chaque route plateforme, les rôles système autorisés d'après la spec 37.
// Épingle le catalogue contre la spec et exerce toutes les branches de refus.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { makeStaff, makeUser } from "@/test/factories";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { isPermission, systemRolePermissions, type Permission } from "@/lib/permissions";

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
