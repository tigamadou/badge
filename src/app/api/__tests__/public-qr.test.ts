import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/public/qr/[registrationId]/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(resetRateLimitForTests);

async function makeRegistration(status: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({ data: { name: "O", slug: `qo-${stamp}` } });
  const ev = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `qs-${stamp}`, location: "L", date: new Date("2026-06-01") },
  });
  const cat = await prisma.category.create({ data: { eventId: ev.id, name: "P", color: "#fff", number: 1 } });
  const user = await prisma.user.create({
    data: { email: `qr-${stamp}@x.test`, password: "x", name: "A", emailVerifiedAt: new Date() },
  });
  return prisma.registration.create({
    data: {
      id: `QR-${stamp}`,
      eventId: ev.id,
      categoryId: cat.id,
      userId: user.id,
      snapshotEmail: "x@x",
      snapshotFirstName: "A",
      snapshotLastName: "B",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "X1",
      snapshotIdDocument: "uploads/test/doc.pdf",
      status: status as never,
    },
  });
}

const call = (id: string, ip = "1.1.1.1") =>
  GET(new Request("http://t", { headers: { "x-forwarded-for": ip } }), {
    params: Promise.resolve({ registrationId: id }),
  });

describe("GET /api/public/qr/[registrationId]", () => {
  it("200 image/png pour une inscription APPROVED", async () => {
    const reg = await makeRegistration("APPROVED");
    const res = await call(reg.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    const buf = Buffer.from(await res.arrayBuffer());
    expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("404 pour PENDING et pour un ID inconnu", async () => {
    const reg = await makeRegistration("PENDING");
    expect((await call(reg.id)).status).toBe(404);
    expect((await call("inconnu")).status).toBe(404);
  });

  it("429 au-delà de la limite", async () => {
    for (let i = 0; i < 60; i++) await call("inconnu", "2.2.2.2");
    expect((await call("inconnu", "2.2.2.2")).status).toBe(429);
  });
});
