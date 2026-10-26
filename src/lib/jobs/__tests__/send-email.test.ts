import { describe, it, expect, afterEach } from "vitest";
import { __mailTesting, type TransportContext } from "@/lib/mail";
import { sendEmailPayload } from "@/lib/jobs/send-email";
import { fakeTransport, FAKE_FROM } from "./helpers";

afterEach(() => __mailTesting.reset());

const payload = { to: "a@x.test", subject: "S", html: "<p>H</p>", kind: "k" };

describe("sendEmailPayload", () => {
  it("sends with the resolved from address and the payload fields", async () => {
    const t = fakeTransport();
    t.install();
    await sendEmailPayload(payload);
    expect(t.sent).toEqual([{ from: FAKE_FROM, to: "a@x.test", subject: "S", html: "<p>H</p>" }]);
  });

  it("passes replyTo when present", async () => {
    const t = fakeTransport();
    t.install();
    await sendEmailPayload({ ...payload, replyTo: "r@x.test" });
    expect(t.sent[0].replyTo).toBe("r@x.test");
  });

  it("resolves the transporter with the payload ctx", async () => {
    const seen: TransportContext[] = [];
    fakeTransport({ onResolve: (c) => seen.push(c) }).install();
    await sendEmailPayload({ ...payload, ctx: { eventId: "e1" } });
    await sendEmailPayload(payload);
    expect(seen).toEqual([{ eventId: "e1" }, {}]);
  });

  it("propagates the SMTP error", async () => {
    fakeTransport({ fail: new Error("SMTP down") }).install();
    await expect(sendEmailPayload(payload)).rejects.toThrow("SMTP down");
  });

  it("rejects with SEND_TIMEOUT when the transporter never answers", async () => {
    fakeTransport({ hang: true }).install();
    await expect(sendEmailPayload(payload, { timeoutMs: 20 })).rejects.toThrow("SEND_TIMEOUT");
  });

  it("uses the default timeout when none is given", async () => {
    fakeTransport().install();
    await expect(sendEmailPayload(payload)).resolves.toBeUndefined();
  });
});
