import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeEventMember, makeStaff, makeUser, type PlatformSystemKey } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  getFile: vi.fn(async () => ({ body: Buffer.from("zip"), contentType: "application/zip" })),
}));
import { getServerSession } from "next-auth";

import { GET } from "../[...path]/route";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function setup() {
  const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  return { org, event };
}

type EventRole = "ADMIN" | "PRINTER" | "VIEWER";

function session(u: { id: string; email: string; name: string | null }, isStaff: boolean) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff },
  } as never);
}

async function login(opts: { eventId?: string; role?: EventRole; staff?: PlatformSystemKey | true }) {
  const staffRole = opts.staff === true ? "STAFF_SUPPORT" : opts.staff;
  const u =
    opts.eventId && opts.role
      ? await makeEventMember(opts.eventId, opts.role, staffRole ? { isStaff: true } : {})
      : staffRole
        ? await makeStaff(staffRole)
        : await makeUser();
  session(u, !!staffRole);
}

const loginStaff = (role: PlatformSystemKey) => login({ staff: role });

const read = (key: string) =>
  GET(new NextRequest(`http://localhost/api/files/${key}`), { params: Promise.resolve({ path: key.split("/") }) });

describe("GET /api/files/badge-exports/{eventId}/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("un PRINTER de l'evenement lit l'archive, sans cache", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "PRINTER" });
    const res = await read(`badge-exports/${event.id}/abc.zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("un PRINTER d'un autre evenement recoit 403", async () => {
    const mine = await setup();
    const other = await setup();
    await login({ eventId: other.event.id, role: "PRINTER" });
    expect((await read(`badge-exports/${mine.event.id}/abc.zip`)).status).toBe(403);
  });

  it("un VIEWER, un anonyme et un evenement inconnu recoivent 403", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "VIEWER" });
    expect((await read(`badge-exports/${event.id}/abc.zip`)).status).toBe(403);
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await read(`badge-exports/${event.id}/abc.zip`)).status).toBe(403);
    await login({});
    expect((await read(`badge-exports/inconnu/abc.zip`)).status).toBe(403);
  });

  it("STAFF_ADMIN et STAFF_PRINTER lisent n'importe quelle archive ; STAFF_OBSERVER et STAFF_SUPPORT non", async () => {
    const { event } = await setup();
    const key = `badge-exports/${event.id}/abc.zip`;
    for (const [role, status] of [
      ["STAFF_ADMIN", 200],
      ["STAFF_PRINTER", 200],
      ["STAFF_OBSERVER", 403],
      ["STAFF_SUPPORT", 403],
    ] as const) {
      await login({ staff: role });
      expect((await read(key)).status, role).toBe(status);
    }
  });
});

describe("GET /api/files/print-requests/... et platform/print-products/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("print-requests/ : 403 sans session et pour un non-staff", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await read("print-requests/staff/x.pdf")).status).toBe(403);
    await login({});
    expect((await read("print-requests/staff/x.pdf")).status).toBe(403);
  });

  it("print-requests/ : 200 private no-store avec print.requests.read, STAFF_OBSERVER compris ; 403 pour STAFF_SUPPORT", async () => {
    await loginStaff("STAFF_OBSERVER");
    const res = await read("print-requests/staff/x.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    await loginStaff("STAFF_PRINTER");
    expect((await read("print-requests/staff/x.pdf")).status).toBe(200);
    await loginStaff("STAFF_SUPPORT");
    expect((await read("print-requests/staff/x.pdf")).status).toBe(403);
  });

  it("platform/print-products/ reste public", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const res = await read("platform/print-products/x.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("refuse toute cle contenant un segment .. (404, sans lecture du stockage)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { getFile } = await import("@/lib/storage");
    vi.mocked(getFile).mockClear();
    const res = await GET(new NextRequest("http://localhost/api/files/x"), {
      params: Promise.resolve({ path: ["platform", "print-products", "..", "..", "profile", "u1", "documents", "id.pdf"] }),
    });
    expect(res.status).toBe(404);
    expect(getFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/files/print-requests/{eventId}/... (organisateur)", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("l'ADMIN de l'évènement lit sa pièce jointe, sans cache", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "ADMIN" });
    const res = await read(`print-requests/${event.id}/x.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("l'ADMIN d'un autre évènement, un PRINTER et un évènement inconnu reçoivent 403", async () => {
    const mine = await setup();
    const other = await setup();
    await login({ eventId: other.event.id, role: "ADMIN" });
    expect((await read(`print-requests/${mine.event.id}/x.pdf`)).status).toBe(403);
    await login({ eventId: mine.event.id, role: "PRINTER" });
    expect((await read(`print-requests/${mine.event.id}/x.pdf`)).status).toBe(403);
    expect((await read(`print-requests/inconnu/x.pdf`)).status).toBe(403);
  });

  it("une clé sans sous-dossier exige print.requests.read", async () => {
    await login({});
    expect((await read("print-requests/x.pdf")).status).toBe(403);
    await loginStaff("STAFF_SUPPORT");
    expect((await read("print-requests/x.pdf")).status).toBe(403);
    await loginStaff("STAFF_OBSERVER");
    expect((await read("print-requests/x.pdf")).status).toBe(200);
  });

  it("le staff avec print.requests.read lit une clé d'évènement", async () => {
    const { event } = await setup();
    await loginStaff("STAFF_OBSERVER");
    expect((await read(`print-requests/${event.id}/x.pdf`)).status).toBe(200);
  });

  it("STAFF_SUPPORT lit une clé d'évènement par print.request, pas sur un évènement inconnu", async () => {
    const { event } = await setup();
    await loginStaff("STAFF_SUPPORT");
    expect((await read(`print-requests/${event.id}/x.pdf`)).status).toBe(200);
    expect((await read("print-requests/inconnu/x.pdf")).status).toBe(403);
  });
});

describe("GET /api/files/print-requests/staff/{requestId}/... (pièce jointe staff)", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  async function seedRequest(eventId: string, orgId: string) {
    return prisma.printRequest.create({
      data: { reference: uniq("PR"), eventId, orgId, type: "ONSITE" } as never,
    });
  }

  it("lisible par l'ADMIN de l'évènement de la commande nommée par la clé, 403 pour un autre évènement", async () => {
    const mine = await setup();
    const other = await setup();
    const req = await seedRequest(mine.event.id, mine.org.id);
    const key = `print-requests/staff/${req.id}/${uniq("k")}.pdf`;
    await login({ eventId: mine.event.id, role: "ADMIN" });
    expect((await read(key)).status).toBe(200);
    await login({ eventId: other.event.id, role: "ADMIN" });
    expect((await read(key)).status).toBe(403);
  });

  it("l'évènement vient de la clé, pas d'un message : réutiliser la clé dans une autre commande n'ouvre rien", async () => {
    const mine = await setup();
    const other = await setup();
    const mineReq = await seedRequest(mine.event.id, mine.org.id);
    const otherReq = await seedRequest(other.event.id, other.org.id);
    const key = `print-requests/staff/${mineReq.id}/${uniq("k")}.pdf`;
    // Un message d'une autre organisation porte (de force, sans passer par postMessage) la même clé.
    await prisma.printRequestMessage.create({
      data: { requestId: otherReq.id, side: "STAFF", kind: "MESSAGE", body: "b", attachmentKey: key } as never,
    });
    await login({ eventId: other.event.id, role: "ADMIN" });
    expect((await read(key)).status).toBe(403);
  });

  it("commande inconnue ou clé sans commande : 403 non-staff, 200 staff", async () => {
    const { event } = await setup();
    await login({ eventId: event.id, role: "ADMIN" });
    expect((await read(`print-requests/staff/ghost/${uniq("orph")}.pdf`)).status).toBe(403);
    expect((await read(`print-requests/staff/${uniq("orph")}.pdf`)).status).toBe(403);
    await loginStaff("STAFF_OBSERVER");
    expect((await read(`print-requests/staff/ghost/${uniq("orph")}.pdf`)).status).toBe(200);
    await loginStaff("STAFF_SUPPORT");
    expect((await read(`print-requests/staff/ghost/${uniq("orph")}.pdf`)).status).toBe(403);
  });
});

describe("GET /api/files/print-sheets/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("print.sheets.read : STAFF_ADMIN et STAFF_PRINTER lisent, les autres rôles et les anonymes non", async () => {
    const key = "print-sheets/gen-1.pdf";
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await read(key)).status).toBe(403);
    await login({});
    expect((await read(key)).status).toBe(403);
    for (const [role, status] of [
      ["STAFF_ADMIN", 200],
      ["STAFF_PRINTER", 200],
      ["STAFF_SUPPORT", 403],
      ["STAFF_OBSERVER", 403],
    ] as const) {
      await loginStaff(role);
      expect((await read(key)).status, role).toBe(status);
    }
  });
});

describe("GET /api/files/events/{eventId}/idDocuments/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("event.read.detailed : STAFF_OBSERVER, STAFF_SUPPORT et STAFF_ADMIN lisent, STAFF_PRINTER non", async () => {
    const { event } = await setup();
    const key = `events/${event.id}/idDocuments/d.pdf`;
    for (const [role, status] of [
      ["STAFF_ADMIN", 200],
      ["STAFF_SUPPORT", 200],
      ["STAFF_OBSERVER", 200],
      ["STAFF_PRINTER", 403],
    ] as const) {
      await loginStaff(role);
      expect((await read(key)).status, role).toBe(status);
    }
  });

  it("le propriétaire de l'organisation lit les pièces de ses évènements, pas celles d'une autre organisation", async () => {
    const { makeOrgMember } = await import("@/test/factories");
    const mine = await setup();
    const other = await setup();
    const owner = await makeOrgMember(mine.org.id, "OWNER");
    session(owner, false);
    expect((await read(`events/${mine.event.id}/idDocuments/d.pdf`)).status).toBe(200);
    expect((await read(`events/${other.event.id}/idDocuments/d.pdf`)).status).toBe(403);
  });
});

describe("GET /api/files/profile/{userId}/documents/...", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("le propriétaire lit son document ; profiles.read ouvre celui des autres (pas à STAFF_PRINTER)", async () => {
    const owner = await makeUser();
    const key = `profile/${owner.id}/documents/d.pdf`;
    session(owner, false);
    expect((await read(key)).status).toBe(200);
    await login({});
    expect((await read(key)).status).toBe(403);
    for (const [role, status] of [
      ["STAFF_ADMIN", 200],
      ["STAFF_SUPPORT", 200],
      ["STAFF_OBSERVER", 200],
      ["STAFF_PRINTER", 403],
    ] as const) {
      await loginStaff(role);
      expect((await read(key)).status, role).toBe(status);
    }
  });
});
