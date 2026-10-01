import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetRateLimitForTests } from "@/lib/rate-limit";

// Mock partiel (fallback sur l'implementation reelle) : permet de simuler un
// envoi mail reussi sans dependre d'un vrai serveur SMTP joignable depuis
// l'environnement de test, tout en laissant le test "SMTP injoignable" passer
// par la vraie implementation (echec reseau reel attendu -- cf. rapport agent).
vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, resolveTransporter: vi.fn(actual.resolveTransporter) };
});
import { resolveTransporter } from "@/lib/mail";
import { POST } from "@/app/api/contact/route";

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
    vi.mocked(resolveTransporter).mockResolvedValueOnce({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    } as never);

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

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
    vi.mocked(resolveTransporter).mockResolvedValueOnce({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    } as never);

    const res = await POST(makeReq({ email: "min@x.test", subject: "Support technique", consent: true }));
    expect(res.status).toBe(200);
    const args = sendMail.mock.calls[0][0];
    expect(args.html).toContain(">—<");
  });

  it("returns 502 when sending the email fails", async () => {
    // sendMail rejette (echec SMTP) : la route doit renvoyer 502. On mocke le
    // transporter plutot que de dependre d'un vrai SMTP injoignable (qui pend
    // sur le timeout de connexion au lieu d'echouer vite).
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP down"));
    vi.mocked(resolveTransporter).mockResolvedValueOnce({
      transporter: { sendMail } as never,
      from: "noreply@badge.test",
      contactEmail: "",
      contactPhone: "",
      settings: { contactEmail: "", contactPhone: "" },
    } as never);

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});
