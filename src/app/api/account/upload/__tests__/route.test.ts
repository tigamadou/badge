import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { resetRateLimitForTests } from "@/lib/rate-limit";

// uploadFile est enveloppe par un vi.fn qui delegue a la vraie implementation par defaut
// (vrai upload S3/MinIO pour tous les tests), sauf pour le test qui verifie la propagation
// d'une erreur non-AuthError (branche `throw err` du catch, l.76) : aucune erreur reelle
// n'est declenchable via requireAuth/formData ici, d'ou ce spy cible plutot qu'un mock
// complet du module (meme logique que le mock de "@/lib/mail" dans registrations.test.ts).
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, uploadFile: vi.fn(actual.uploadFile) };
});
import { uploadFile } from "@/lib/storage";
import { makePng } from "@/test/factories-2a";

const PHOTO = makePng(420, 540);

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}
function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

function makeReq(
  kind: string | null,
  file?: { name?: string; type: string; bytes: Buffer },
): NextRequest {
  const url = kind === null
    ? "http://localhost/api/account/upload"
    : `http://localhost/api/account/upload?kind=${kind}`;
  if (!file) {
    return new NextRequest(url, { method: "POST", body: new FormData() });
  }
  const fd = new FormData();
  const ab = new ArrayBuffer(file.bytes.byteLength);
  new Uint8Array(ab).set(file.bytes);
  const blob = new Blob([ab], { type: file.type });
  if (file.name !== undefined) {
    fd.append("file", blob, file.name);
  } else {
    fd.append("file", blob);
  }
  return new NextRequest(url, { method: "POST", body: fd });
}

describe("POST /api/account/upload", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    resetRateLimitForTests();
  });

  afterEach(() => {
    vi.mocked(uploadFile).mockClear();
  });

  it("returns 401 without session", async () => {
    noSession();
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(makeReq("photo", { name: "p.jpg", type: "image/jpeg", bytes: Buffer.from("x") }));
    expect(res.status).toBe(401);
  });

  it("returns 400 BAD_KIND when kind is missing", async () => {
    withSession({ id: "u-1", email: "u1@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(makeReq(null));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_KIND");
  });

  it("returns 400 BAD_KIND when kind is invalid", async () => {
    withSession({ id: "u-2", email: "u2@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(makeReq("something-else"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_KIND");
  });

  it("returns 400 NO_FILE when the file is missing", async () => {
    withSession({ id: "u-3", email: "u3@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(makeReq("photo"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_FILE");
  });

  it("returns 415 BAD_TYPE for a disallowed mime", async () => {
    withSession({ id: "u-4", email: "u4@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(
      makeReq("photo", { name: "p.txt", type: "text/plain", bytes: Buffer.from("x") }),
    );
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.code).toBe("BAD_TYPE");
  });

  it("returns 415 BAD_TYPE when the mime is missing (falls back to octet-stream)", async () => {
    withSession({ id: "u-5", email: "u5@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    // Un Blob cree via `new Blob(...)` sans `type`, une fois serialise/reparse par le
    // FormData multipart, se voit toujours attribuer un Content-Type concret par undici
    // (verifie empiriquement : jamais "" via l'API Blob/FormData). Pour exercer reellement
    // la branche `file.type || "application/octet-stream"` (mime absent), on construit un
    // corps multipart brut avec un header `Content-Type:` explicitement vide.
    const boundary = "----acct-upload-test";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="p.jpg"\r\n` +
      `Content-Type: \r\n` +
      `\r\n` +
      `hello\r\n` +
      `--${boundary}--\r\n`;
    const req = new NextRequest("http://localhost/api/account/upload?kind=photo", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.code).toBe("BAD_TYPE");
  });

  it("returns 413 TOO_LARGE for files over 5 Mo", async () => {
    withSession({ id: "u-6", email: "u6@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await POST(
      makeReq("photo", { name: "big.jpg", type: "image/jpeg", bytes: big }),
    );
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.code).toBe("TOO_LARGE");
  });

  it("accepts a valid JPEG for kind=photo and returns a profile storage key", async () => {
    withSession({ id: "u-7", email: "u7@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(
      makeReq("photo", { name: "p.png", type: "image/png", bytes: PHOTO }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^profile\/u-7\/photos\/.+\.png$/);
    expect(json.originalName).toBe("p.png");
    expect(json.kind).toBe("photo");
    expect(json.size).toBe(PHOTO.length);
  });

  it("accepts a valid PDF for kind=document and returns a profile storage key", async () => {
    withSession({ id: "u-8", email: "u8@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(
      makeReq("document", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^profile\/u-8\/documents\/.+\.pdf$/);
    expect(json.kind).toBe("document");
  });

  it("rejects a PDF when kind=photo", async () => {
    withSession({ id: "u-9", email: "u9@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(
      makeReq("photo", { name: "d.pdf", type: "application/pdf", bytes: Buffer.from("%PDF") }),
    );
    expect(res.status).toBe(415);
  });

  it("infers the extension from the mime (.pdf) when the uploaded part has no dot in its name", async () => {
    withSession({ id: "u-10", email: "u10@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    // Un Blob ajoute sans 3e argument `filename` est normalise par le FormData en File
    // nomme "blob" (WHATWG spec + verifie empiriquement avec NextRequest.formData()) :
    // origName = "blob", extOf("blob", ...) n'a pas de "." -> retombe sur le fallback lie
    // au mime (l.21-24 : ".pdf" ici). La branche `file instanceof File ? ... : "upload"`
    // (l.64) n'est donc jamais fausse en pratique : voir note dans le rapport.
    const res = await POST(
      makeReq("document", { type: "application/pdf", bytes: Buffer.from("%PDF") }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.originalName).toBe("blob");
    expect(json.storageKey).toMatch(/^profile\/u-10\/documents\/.+\.pdf$/);
  });

  it("infers the extension as .bin (mime fallback) when the uploaded part has no dot in its name and is not a PDF", async () => {
    withSession({ id: "u-12", email: "u12@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    const res = await POST(
      makeReq("photo", { type: "image/png", bytes: PHOTO }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^profile\/u-12\/photos\/.+\.bin$/);
  });

  it("rethrows a non-AuthError raised by the storage layer", async () => {
    withSession({ id: "u-13", email: "u13@v4-account-upload.test", name: "U", isStaff: false });
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error("boom-upload"));
    const { POST } = await import("@/app/api/account/upload/route");
    await expect(
      POST(makeReq("photo", { name: "p.png", type: "image/png", bytes: PHOTO })),
    ).rejects.toThrow("boom-upload");
  });

  it("returns 429 RATE_LIMITED after 20 requests within the window", async () => {
    withSession({ id: "u-11", email: "u11@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    let lastRes;
    for (let i = 0; i < 21; i++) {
      lastRes = await POST(
        makeReq("photo", { name: `p${i}.jpg`, type: "image/jpeg", bytes: Buffer.from("x") }),
      );
    }
    expect(lastRes!.status).toBe(429);
    const json = await lastRes!.json();
    expect(json.code).toBe("RATE_LIMITED");
    expect(lastRes!.headers.get("retry-after")).not.toBeNull();
  });

  async function sender(kind: "photo" | "document") {
    withSession({ id: "u-2a", email: "u2a@v4-account-upload.test", name: "U", isStaff: false });
    const { POST } = await import("@/app/api/account/upload/route");
    return (file: { name: string; type: string; bytes: Buffer }) => POST(makeReq(kind, file));
  }
  const photoSender = () => sender("photo");
  const documentSender = () => sender("document");

  it("kind=photo : accepte 420x540, refuse hors ratio, trop petit ou non image", async () => {
    const send = await photoSender();
    const png = (w: number, h: number) => ({ name: "p.png", type: "image/png", bytes: makePng(w, h) });
    expect((await send(png(420, 540))).status).toBe(200);

    const square = await send(png(540, 540));
    expect(square.status).toBe(422);
    expect(await square.json()).toMatchObject({
      code: "IMAGE_RATIO",
      message: "Ratio attendu 7:9, par ex. 210 × 270 px.",
    });

    const tiny = await send(png(140, 180));
    expect(tiny.status).toBe(422);
    expect((await tiny.json()).code).toBe("IMAGE_RESOLUTION");

    expect((await send(png(428, 540))).status).toBe(200);
    expect((await send(png(429, 540))).status).toBe(422);

    const text = await send({ name: "p.png", type: "image/png", bytes: Buffer.from("texte") });
    expect(text.status).toBe(400);
    expect((await text.json()).code).toBe("INVALID_IMAGE");
  });

  it("kind=document : une image quelconque reste acceptée", async () => {
    const send = await documentSender();
    expect((await send({ name: "d.png", type: "image/png", bytes: makePng(10, 10) })).status).toBe(200);
  });
});
