import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/public/events/[slug]/route";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(async () => {
  resetRateLimitForTests();
  await prisma.platformSettings.deleteMany();
  await prisma.platformSettings.create({
    data: {
      id: "singleton",
      smtpHost: "p", smtpPort: 587, smtpFrom: "p@x",
      smtpUser: "", smtpPassword: "", smtpSecure: false,
      recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "",
    },
  });
});

describe("GET /api/public/events/[slug]", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when registrations closed", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o1" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ev1", location: "", date: new Date(), registrationOpen: false },
    });
    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "ev1" }) });
    expect(res.status).toBe(403);
  });

  it("returns event + categories + public settings", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    const ev = await prisma.event.create({
      data: { orgId: org.id, title: "E2", slug: "ev2", location: "L", date: new Date(), registrationOpen: true },
    });
    await prisma.category.create({ data: { eventId: ev.id, name: "C1", color: "#fff", number: 1 } });

    const res = await GET(new Request("http://t/x") as unknown as Request, { params: Promise.resolve({ slug: "ev2" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.event.title).toBe("E2");
    expect(json.categories).toHaveLength(1);
    expect("smtpPassword" in json.settings).toBe(false);
    expect("recaptchaSecretKey" in json.settings).toBe(false);
  });
});
