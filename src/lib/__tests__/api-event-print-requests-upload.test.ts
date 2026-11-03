import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage")>()),
  uploadFile: vi.fn(async () => undefined),
}));
// Les gardes d'abonnement sont couverts ailleurs : l'organisation est considérée active.
vi.mock("@/lib/subscription-access", async () => {
  const { DEFAULT_RIGHTS } = await import("@/lib/subscription-rights");
  return {
    loadOrgAccess: vi.fn(async () => ({
      active: true,
      maxEvents: null,
      maxParticipantsPerEvent: null,
      rights: DEFAULT_RIGHTS,
    })),
  };
});
import { getServerSession } from "next-auth";
import { uploadFile, printRequestFileKey } from "@/lib/storage";
import { POST } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/upload/route";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function seed(role: "ADMIN" | "OPERATOR", archived = false) {
  const s = stamp();
  const user = await prisma.user.create({ data: { email: `pu-${s}@x.test`, password: "x", name: "U" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${s}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${s}`, location: "L", date: new Date("2026-10-01"), archived },
  });
  await prisma.eventMembership.create({ data: { userId: user.id, eventId: event.id, role } });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name, isStaff: false },
  } as never);
  return { org, event };
}

function req(orgId: string, eventId: string, file?: { name: string; type: string; size: number }) {
  const fd = new FormData();
  if (file) fd.append("file", new Blob([new Uint8Array(file.size)], { type: file.type }), file.name);
  return new NextRequest(`http://localhost/api/org/${orgId}/events/${eventId}/print-requests/upload`, {
    method: "POST",
    body: fd,
  });
}
const call = (orgId: string, eventId: string, file?: { name: string; type: string; size: number }) =>
  POST(req(orgId, eventId, file), { params: Promise.resolve({ orgId, eventId }) });

describe("printRequestFileKey", () => {
  it("préfixe par l'évènement", () => {
    expect(printRequestFileKey("ev1", "a.pdf")).toBe("print-requests/ev1/a.pdf");
  });
});

describe("POST …/print-requests/upload", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(uploadFile).mockClear();
  });

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const res = await call("o", "e", { name: "a.pdf", type: "application/pdf", size: 3 });
    expect(res.status).toBe(401);
  });

  it("403 pour un OPERATOR", async () => {
    const { org, event } = await seed("OPERATOR");
    const res = await call(org.id, event.id, { name: "a.pdf", type: "application/pdf", size: 3 });
    expect(res.status).toBe(403);
  });

  it("400 NO_FILE sans fichier", async () => {
    const { org, event } = await seed("ADMIN");
    const res = await call(org.id, event.id);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_FILE");
  });

  it("400 NO_FILE sur un corps qui n'est pas un formulaire", async () => {
    const { org, event } = await seed("ADMIN");
    const bad = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/print-requests/upload`, {
      method: "POST",
      body: "pas un formulaire",
      headers: { "content-type": "text/plain" },
    });
    const res = await POST(bad, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_FILE");
  });

  it("415 BAD_TYPE hors JPEG/PNG/WebP/PDF", async () => {
    const { org, event } = await seed("ADMIN");
    const res = await call(org.id, event.id, { name: "a.txt", type: "text/plain", size: 3 });
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("BAD_TYPE");
  });

  it("413 TOO_LARGE au-delà de 5 Mo", async () => {
    const { org, event } = await seed("ADMIN");
    const res = await call(org.id, event.id, { name: "a.png", type: "image/png", size: 5 * 1024 * 1024 + 1 });
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("TOO_LARGE");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("200 : clé préfixée par l'évènement, y compris évènement archivé", async () => {
    const { org, event } = await seed("ADMIN", true);
    const res = await call(org.id, event.id, { name: "Maquette.PDF", type: "application/pdf", size: 4 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(new RegExp(`^print-requests/${event.id}/[A-Za-z0-9._-]+\\.pdf$`));
    expect(json.originalName).toBe("Maquette.PDF");
    expect(json.size).toBe(4);
    expect(uploadFile).toHaveBeenCalledOnce();
  });
});
