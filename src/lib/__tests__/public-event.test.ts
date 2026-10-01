import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  loadPublicEventBySlug,
  loadEventByIdForVerify,
  PublicEventError,
} from "@/lib/public-event";

describe("loadPublicEventBySlug", () => {
  beforeEach(async () => {
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

  it("throws NOT_FOUND when slug unknown", async () => {
    await expect(loadPublicEventBySlug("nope")).rejects.toBeInstanceOf(PublicEventError);
    await expect(loadPublicEventBySlug("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws CLOSED when registrationOpen=false", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "s1", location: "", date: new Date(), registrationOpen: false },
    });
    await expect(loadPublicEventBySlug("s1")).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("throws CLOSED when archived=true even if open", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "s2", location: "", date: new Date(), registrationOpen: true, archived: true },
    });
    await expect(loadPublicEventBySlug("s2")).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("returns event + categories + public settings when open", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o3" } });
    const ev = await prisma.event.create({
      data: {
        orgId: org.id, title: "Event 3", slug: "s3", location: "Loc", date: new Date(),
        registrationOpen: true,
      },
    });
    await prisma.category.create({
      data: { eventId: ev.id, name: "Press", color: "#fff", number: 10 },
    });
    const r = await loadPublicEventBySlug("s3");
    expect(r.event.id).toBe(ev.id);
    expect(r.categories).toHaveLength(1);
    expect(r.settings).toBeDefined();
    expect("smtpPassword" in r.settings).toBe(false);
    expect("recaptchaSecretKey" in r.settings).toBe(false);
  });
});

describe("loadEventByIdForVerify", () => {
  it("returns the selected fields for an existing event (including archived)", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "ov" } });
    const ev = await prisma.event.create({
      data: {
        orgId: org.id, title: "V", slug: "v1", location: "Loc",
        date: new Date("2025-01-01"), registrationOpen: false, archived: true,
      },
    });
    const r = await loadEventByIdForVerify(ev.id);
    expect(r).not.toBeNull();
    expect(r!.id).toBe(ev.id);
    expect(r!.title).toBe("V");
    expect(r!.slug).toBe("v1");
    expect(r!.archived).toBe(true);
  });

  it("returns null when eventId unknown", async () => {
    const r = await loadEventByIdForVerify("nonexistent-id");
    expect(r).toBeNull();
  });
});
