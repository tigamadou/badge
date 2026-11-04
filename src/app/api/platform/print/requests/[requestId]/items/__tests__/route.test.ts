import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeRegistration } from "@/test/factories";
import { seedPrintFixture, makeRequest, type PrintFixture } from "@/lib/__tests__/helpers/print-requests";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET } from "../route";

type User = { id: string; email: string; name: string };
let fx: PrintFixture;

function as(user: User | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    (user ? { user: { id: user.id, email: user.email, name: user.name, isStaff: true } } : null) as never,
  );
}

async function get(requestId: string, query = "") {
  const req = new NextRequest(`http://localhost/api/platform/print/requests/${requestId}/items${query}`);
  const res = await GET(req, { params: Promise.resolve({ requestId }) });
  return { status: res.status, json: await res.json() };
}

async function orderWithItems(count: number) {
  const request = await makeRequest(fx, { status: "SUBMITTED" });
  for (let i = 0; i < count; i++) {
    const reg = await makeRegistration(fx.event.id, fx.categories[0].id, "APPROVED", {
      snapshotFirstName: `Prenom${String(i).padStart(2, "0")}`,
      snapshotLastName: i === 12 ? "Zorglub" : "Nom",
    });
    await prisma.printRequestItem.create({ data: { requestId: request.id, registrationId: reg.id, position: i } });
  }
  return request;
}

beforeEach(async () => {
  vi.mocked(getServerSession).mockReset();
  fx = await seedPrintFixture();
  as(fx.staffObserver);
});

describe("GET /api/platform/print/requests/[requestId]/items", () => {
  it("renvoie la tranche demandée, triée par position", async () => {
    const r = await orderWithItems(45);
    const res = await get(r.id, "?pageSize=10&page=2");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ total: 45, page: 2, pageSize: 10 });
    expect(res.json.items.map((i: { position: number }) => i.position)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(res.json.items[0]).toEqual({
      registrationId: expect.any(String),
      position: 10,
      firstName: "Prenom10",
      lastName: "Nom",
      categoryName: "Participant",
      status: "APPROVED",
      badgePrinted: false,
    });
  });

  it("filtre par mot dans le prénom ou le nom", async () => {
    const r = await orderWithItems(20);
    const res = await get(r.id, "?q=zorg%20prenom12");
    expect(res.json.total).toBe(1);
    expect(res.json.items[0].lastName).toBe("Zorglub");
  });

  it("borne la page demandée à la dernière", async () => {
    const r = await orderWithItems(15);
    const res = await get(r.id, "?pageSize=10&page=99");
    expect(res.json).toMatchObject({ total: 15, page: 2 });
    expect(res.json.items).toHaveLength(5);
  });

  it("ne renvoie pas les badges d'une autre commande", async () => {
    const r = await orderWithItems(3);
    await orderWithItems(4);
    expect((await get(r.id)).json.total).toBe(3);
  });

  it("404 pour une commande inexistante ou en brouillon", async () => {
    expect((await get("inconnue")).status).toBe(404);
    const draft = await makeRequest(fx, { status: "DRAFT" });
    expect((await get(draft.id)).status).toBe(404);
  });

  it("401 sans session, 403 pour un non-staff", async () => {
    const r = await orderWithItems(1);
    as(null);
    expect((await get(r.id)).status).toBe(401);
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: fx.owner.id, email: fx.owner.email, name: "o", isStaff: false } } as never);
    expect((await get(r.id)).status).toBe(403);
  });
});
