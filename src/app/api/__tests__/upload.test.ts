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

  it("returns 400 BAD_CONTEXT when the context query param is missing", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "p.jpg");
    const req = new Request("http://test/api/upload?kind=photo", { method: "POST", body: fd });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_CONTEXT");
  });

  it("returns 400 BAD_CONTEXT when kind is invalid", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "p.jpg");
    const req = new Request("http://test/api/upload?context=event:whatever&kind=bogus", { method: "POST", body: fd });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_CONTEXT");
  });

  it("returns 400 NO_FILE when the form has no file field", async () => {
    const ev = await setupOpenEvent("u6");
    const fd = new FormData();
    const req = new Request(`http://test/api/upload?context=event:${ev.slug}&kind=photo`, {
      method: "POST",
      body: fd,
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 400 BAD_CONTEXT when the context does not match the event: prefix", async () => {
    // parseContext : chaine presente mais non conforme au format `event:<slug>`
    // -> le ternaire renvoie null (branche alternate) -> BAD_CONTEXT.
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "p.jpg");
    const req = new Request("http://test/api/upload?context=not-an-event&kind=photo", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_CONTEXT");
  });

  it("returns 415 BAD_TYPE when the file has an empty mime type (fallback octet-stream)", async () => {
    // Un Blob sans type se voit toujours attribuer un Content-Type concret par undici
    // apres serialisation FormData. Pour exercer la branche `file.type || "application/
    // octet-stream"`, on construit un corps multipart brut avec un `Content-Type:` vide.
    const ev = await setupOpenEvent("u-mime");
    const boundary = "----upload-empty-mime";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="p.jpg"\r\n` +
      `Content-Type: \r\n` +
      `\r\n` +
      `hello\r\n` +
      `--${boundary}--\r\n`;
    const req = new Request(`http://test/api/upload?context=event:${ev.slug}&kind=photo`, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.code).toBe("BAD_TYPE");
  });

  it("accepts a photo whose filename has no extension (extOf fallback)", async () => {
    // origName sans point -> extOf renvoie le fallback (.pdf/.bin selon mime).
    const ev = await setupOpenEvent("u-noext");
    const req = makeReq(ev.slug, "photo", { name: "noext", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^events\/.+\/photos\//);
  });

  it("returns 429 RATE_LIMITED after 10 requests within the window", async () => {
    for (let i = 0; i < 10; i++) {
      const req = makeReq("no-such-event-rl", "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
      await POST(req as unknown as Request);
    }
    const req = makeReq("no-such-event-rl", "photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("RATE_LIMITED");
  });
});
