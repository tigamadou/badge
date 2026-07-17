import { describe, it, expect, beforeEach, beforeAll, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/upload/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
});

afterEach(async () => {
  await fs.rm(path.join(process.cwd(), "uploads", "events"), {
    recursive: true,
    force: true,
  });
});

async function setupOpenEvent(slug = "evt-up") {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${slug}` } });
  return prisma.event.create({
    data: { orgId: org.id, title: "E", slug, location: "", date: new Date(), registrationOpen: true },
  });
}

function makeReq(slug: string, kind: "photo" | "document", file: { name: string; type: string; bytes: Buffer }) {
  const fd = new FormData();
  const ab = new ArrayBuffer(file.bytes.byteLength);
  new Uint8Array(ab).set(file.bytes);
  fd.append("file", new Blob([ab], { type: file.type }), file.name);
  return new Request(`http://test/api/upload?context=event:${slug}&kind=${kind}`, {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/upload", () => {
  it("accepts a valid JPEG for photo", async () => {
    const ev = await setupOpenEvent();
    const req = makeReq(ev.slug, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("xxx") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    const json = await res.json();
    // v4 Task 5.3 : contrat unifie -> storageKey (plus de token HMAC).
    expect(json.storageKey).toMatch(/^events\/.+\/photos\//);
    expect(json.kind).toBe("photo");
  });

  it("returns 404 for unknown slug", async () => {
    const req = makeReq("nope", "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(404);
  });

  it("returns 403 if event is closed", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "c1" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evtc", location: "", date: new Date(), registrationOpen: false },
    });
    const req = makeReq(ev.slug, "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(403);
  });

  it("returns 415 for disallowed mime", async () => {
    const ev = await setupOpenEvent("u2");
    const req = makeReq(ev.slug, "photo", { name: "p.txt", type: "text/plain", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(415);
  });

  it("returns 413 for files > 5 Mo", async () => {
    const ev = await setupOpenEvent("u3");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const req = makeReq(ev.slug, "photo", { name: "big.jpg", type: "image/jpeg", bytes: big });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(413);
  });

  it("accepts PDF for document kind", async () => {
    const ev = await setupOpenEvent("u4");
    const req = makeReq(ev.slug, "document", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
  });

  it("rejects PDF when kind=photo", async () => {
    const ev = await setupOpenEvent("u5");
    const req = makeReq(ev.slug, "photo", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(415);
  });
});
