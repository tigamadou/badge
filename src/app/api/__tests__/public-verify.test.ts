import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/public/verify/[badgeId]/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(resetRateLimitForTests);

async function makeRegistration({ status = "APPROVED", printed = true, anonymous = false } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const ev = await prisma.event.create({
    data: { orgId: org.id, title: "Cerimonia", slug: `s-${stamp}`, location: "L", date: new Date("2026-06-01"), registrationOpen: true },
  });
  const cat = await prisma.category.create({
    data: { eventId: ev.id, name: "Presse", color: "#fff", number: 1, anonymous },
  });
  const user = await prisma.user.create({
    data: {
      email: `pv-${stamp}@x.test`,
      password: "x",
      name: "Alice Doe",
      emailVerifiedAt: new Date(),
    },
  });
  return prisma.registration.create({
    data: {
      id: "111111111111",
      eventId: ev.id,
      categoryId: cat.id,
      userId: user.id,
      snapshotEmail: "x@x",
      snapshotFirstName: "Alice",
      snapshotLastName: "Doe",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "X1",
      snapshotIdDocument: "uploads/test/doc.pdf",
      status: status as never,
      badgePrinted: printed,
      badgePrintedAt: printed ? new Date() : null,
    },
  });
}

describe("GET /api/public/verify/[badgeId]", () => {
  it("returns valid=true with details for an approved printed badge", async () => {
    await makeRegistration({ status: "APPROVED", printed: true });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(true);
    expect(j.participant.firstName).toBe("Alice");
    expect(j.category.name).toBe("Presse");
  });

  it("masks identity when anonymous category", async () => {
    await makeRegistration({ status: "APPROVED", printed: true, anonymous: true });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(true);
    expect(j.participant).toBeUndefined();
    expect(j.category.anonymous).toBe(true);
  });

  it("returns valid=false for PENDING", async () => {
    await makeRegistration({ status: "PENDING", printed: false });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    const j = await res.json();
    expect(j.valid).toBe(false);
    expect(j.participant).toBeUndefined();
  });

  it("returns valid=false when approved but not printed", async () => {
    await makeRegistration({ status: "APPROVED", printed: false });
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "111111111111" }) });
    expect((await res.json()).valid).toBe(false);
  });

  it("returns 404 for unknown badge", async () => {
    const res = await GET(new Request("http://t") as unknown as Request, { params: Promise.resolve({ badgeId: "000000000000" }) });
    expect(res.status).toBe(404);
  });
});
