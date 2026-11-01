import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage")>()),
  uploadFile: vi.fn(async () => undefined),
}));
import { getServerSession } from "next-auth";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function login(role?: "STAFF_OBSERVER" | "STAFF_SUPPORT" | "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `${uniq("u")}@x`,
      password: "x",
      name: "U",
      ...(role ? { isStaff: true, staffRole: role } : {}),
    },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: !!role },
  } as never);
}

type F = { name: string; type: string; bytes: Buffer };
function makeReq(context: string | null, file?: F, requestId?: string): NextRequest {
  const fd = new FormData();
  if (file) {
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    fd.append("file", new Blob([ab], { type: file.type }), file.name);
  }
  const qs = context === null ? "" : `?context=${context}${requestId ? `&requestId=${requestId}` : ""}`;
  return new NextRequest(`http://localhost/api/platform/upload${qs}`, { method: "POST", body: fd });
}
const noParams = { params: Promise.resolve({}) };
const jpg: F = { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("xxx") };
const pdf: F = { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") };

async function post(req: NextRequest) {
  const { POST } = await import("@/app/api/platform/upload/route");
  return POST(req, noParams);
}

describe("POST /api/platform/upload", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("401 sans session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await post(makeReq("print-product", jpg))).status).toBe(401);
  });

  it("403 pour un non-staff", async () => {
    await login();
    expect((await post(makeReq("print-product", jpg))).status).toBe(403);
  });

  it("403 STAFF_SUPPORT avec print-product", async () => {
    await login("STAFF_SUPPORT");
    expect((await post(makeReq("print-product", jpg))).status).toBe(403);
  });

  it("403 STAFF_OBSERVER avec print-request", async () => {
    await login("STAFF_OBSERVER");
    expect((await post(makeReq("print-request", pdf))).status).toBe(403);
  });

  it("400 BAD_CONTEXT sans contexte et avec un contexte inconnu", async () => {
    await login("STAFF_ADMIN");
    for (const ctx of [null, "avatar"]) {
      const res = await post(makeReq(ctx, jpg));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("BAD_CONTEXT");
    }
  });

  it("400 NO_FILE : formulaire vide et multipart illisible", async () => {
    await login("STAFF_ADMIN");
    const empty = await post(makeReq("print-product"));
    expect(empty.status).toBe(400);
    expect((await empty.json()).code).toBe("NO_FILE");
    const broken = await post(
      new NextRequest("http://localhost/api/platform/upload?context=print-product", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=broken" },
        body: "not-a-valid-multipart-body",
      }),
    );
    expect(broken.status).toBe(400);
    expect((await broken.json()).code).toBe("NO_FILE");
  });

  it("print-product : PDF -> 415 BAD_TYPE", async () => {
    await login("STAFF_ADMIN");
    const res = await post(makeReq("print-product", pdf));
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("BAD_TYPE");
  });

  it("print-product : 5 Mo + 1 octet -> 413 TOO_LARGE", async () => {
    await login("STAFF_ADMIN");
    const big = { name: "b.jpg", type: "image/jpeg", bytes: Buffer.alloc(5 * 1024 * 1024 + 1) };
    const res = await post(makeReq("print-product", big));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("TOO_LARGE");
  });

  it("print-product : JPEG, PNG, WebP -> cle platform/print-products/", async () => {
    await login("STAFF_ADMIN");
    const re = /^platform\/print-products\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
    for (const [type, ext] of [["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]) {
      const res = await post(makeReq("print-product", { name: `p.${ext}`, type, bytes: Buffer.from("x") }));
      expect(res.status).toBe(200);
      const { storageKey } = await res.json();
      expect(storageKey).toMatch(re);
      expect(storageKey.endsWith(`.${ext}`)).toBe(true);
    }
  });

  async function aRequest() {
    const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
    });
    return prisma.printRequest.create({
      data: { reference: uniq("PR"), eventId: event.id, orgId: org.id, type: "ADVANCE", status: "SUBMITTED" },
    });
  }

  it("print-request : PDF accepte par STAFF_SUPPORT, cle rangee sous la demande", async () => {
    await login("STAFF_SUPPORT");
    const r = await aRequest();
    const res = await post(makeReq("print-request", pdf, r.id));
    expect(res.status).toBe(200);
    expect((await res.json()).storageKey).toMatch(
      new RegExp(`^print-requests/staff/${r.id}/[0-9a-f-]{36}\\.pdf$`),
    );
  });

  it("print-request : demande absente ou inconnue -> 400 BAD_REQUEST_ID", async () => {
    await login("STAFF_SUPPORT");
    for (const id of [undefined, "ghost"]) {
      const res = await post(makeReq("print-request", pdf, id));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("BAD_REQUEST_ID");
    }
  });

  it("print-request : text/plain -> 415", async () => {
    await login("STAFF_SUPPORT");
    const r = await aRequest();
    const res = await post(makeReq("print-request", { name: "a.txt", type: "text/plain", bytes: Buffer.from("x") }, r.id));
    expect(res.status).toBe(415);
  });
});

describe("POST /api/platform/upload : erreur inattendue", () => {
  it("relance une erreur qui n'est pas une AuthError (print-product)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth-guards", async (orig) => ({
      ...(await orig<typeof import("@/lib/auth-guards")>()),
      // 1er appel : garde du wrapper (passe) ; 2e appel : STAFF_ADMIN dans la route (echoue).
      requireStaff: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("boom")),
    }));
    try {
      await login("STAFF_ADMIN");
      await expect(post(makeReq("print-product", jpg))).rejects.toThrow("boom");
    } finally {
      vi.doUnmock("@/lib/auth-guards");
      vi.resetModules();
    }
  });
});
