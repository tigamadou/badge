import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetRateLimitForTests } from "@/lib/rate-limit";

// Passe-plat : observe l'appel à enqueueEmail tout en gardant l'envoi réel (transport simulé).
vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/enqueue-email")>();
  return { ...actual, enqueueEmail: vi.fn(actual.enqueueEmail) };
});
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import { POST } from "@/app/api/contact/route";
import { prisma } from "@/lib/prisma";
import { drainEmailQueue } from "@/lib/jobs/__tests__/helpers";

function useTransport(transport: Record<string, unknown>) {
  __mailTesting.setResolveTransporter(async () => transport as unknown as ResolvedTransport);
}

const VALID_BODY = {
  firstName: "Alice",
  lastName: "Doe",
  email: "alice@x.test",
  organization: "ACME",
  subject: "Demander une démo",
  message: "Bonjour, <script>alert(1)</script> & merci",
  consent: true,
};

function makeReq(body?: unknown, rawBody?: string): Request {
  return new Request("http://test/api/contact", {
    method: "POST",
    body: rawBody ?? JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.mocked(enqueueEmail).mockClear();
  });

  afterEach(() => {
    __mailTesting.reset();
    vi.restoreAllMocks();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const res = await POST(makeReq(undefined, "{not-valid-json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 400 VALIDATION when the email is malformed", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION when consent is missing", async () => {
    const body = {
      firstName: "Alice",
      lastName: "Doe",
      email: "alice@x.test",
      organization: "ACME",
      subject: "Autre",
      message: "hi",
    };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION when subject is not one of the allowed values", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, subject: "Autre chose" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION");
  });

  it("returns 429 after 5 requests within the rate-limit window", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeReq(VALID_BODY));
    }
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("sends the email and returns 200 ok on a valid submission", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    useTransport({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // L'envoi se fait dans le worker : on le simule en vidant la queue.
    await drainEmailQueue();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const args = sendMail.mock.calls[0][0];
    expect(args.from).toBe("noreply@badge.test");
    expect(args.to).toBe("noreply@badge.test");
    expect(args.replyTo).toBe(VALID_BODY.email);
    expect(args.subject).toBe(`Contact — ${VALID_BODY.subject}`);
    // L'injection HTML dans "message" doit etre echappee dans le corps du mail.
    expect(args.html).toContain("&lt;script&gt;");
    expect(args.html).not.toContain("<script>alert(1)</script>");
  });

  it("returns 200 ok and defaults name/organization/message placeholders when omitted", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    useTransport({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    });

    const res = await POST(makeReq({ email: "min@x.test", subject: "Support technique", consent: true }));
    expect(res.status).toBe(200);
    await drainEmailQueue();
    const args = sendMail.mock.calls[0][0];
    expect(args.html).toContain(">—<");
  });

  it("met le message en file avec replyTo et le kind contact.message", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    useTransport({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    });

    await POST(makeReq(VALID_BODY));
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueEmail).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: "noreply@badge.test",
        replyTo: VALID_BODY.email,
        kind: "contact.message",
      }),
    );
  });

  it("returns 200 ok even when sending the email fails (retry par le worker)", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP down"));
    useTransport({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    await drainEmailQueue();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(await prisma.job.findFirstOrThrow()).toMatchObject({
      status: "PENDING",
      attempts: 1,
      lastError: "SMTP down",
    });
  });
});
