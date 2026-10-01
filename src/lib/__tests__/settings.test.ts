import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resolveSettings,
  resolvePublicSettings,
  getPlatformSmtp,
  getPlatformRecaptcha,
  getPlatformPublicRecaptcha,
} from "@/lib/settings";

describe("resolveSettings", () => {
  beforeEach(async () => {
    await prisma.eventSettings.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "platform-smtp",
        smtpPort: 587,
        smtpFrom: "platform@badge.local",
        smtpUser: "",
        smtpPassword: "PLATFORM_PW",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
  });

  it("returns platform contact defaults when no org/event override", async () => {
    const s = await resolveSettings();
    expect(s.contactEmail).toBe("");
    expect(s.contactPhone).toBe("");
  });

  it("never exposes SMTP fields in the resolved settings", async () => {
    const s = await resolveSettings();
    expect("smtpHost" in s).toBe(false);
    expect("smtpPort" in s).toBe(false);
    expect("smtpFrom" in s).toBe(false);
    expect("smtpUser" in s).toBe(false);
    expect("smtpPassword" in s).toBe(false);
    expect("smtpSecure" in s).toBe(false);
  });

  it("never exposes reCAPTCHA fields in the resolved settings", async () => {
    const s = await resolveSettings();
    expect("recaptchaEnabled" in s).toBe(false);
    expect("recaptchaSiteKey" in s).toBe(false);
    expect("recaptchaSecretKey" in s).toBe(false);
  });

  it("org contactEmail override wins over platform", async () => {
    const org = await prisma.organization.create({
      data: { name: "O", slug: "o", contactEmail: "org@x" },
    });
    const s = await resolveSettings(undefined, org.id);
    expect(s.contactEmail).toBe("org@x");
  });

  it("event contactEmail override wins over org", async () => {
    const org = await prisma.organization.create({
      data: { name: "O", slug: "o2", contactEmail: "org@x" },
    });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e2", location: "L", date: new Date() },
    });
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "event@x" },
    });

    const s = await resolveSettings(event.id);
    expect(s.contactEmail).toBe("event@x");
  });
});

describe("getPlatformSmtp", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "platform-smtp",
        smtpPort: 587,
        smtpFrom: "platform@badge.local",
        smtpUser: "u",
        smtpPassword: "PLATFORM_PW",
        smtpSecure: false,
      },
    });
  });

  it("reads SMTP directly from PlatformSettings, no cascade", async () => {
    const smtp = await getPlatformSmtp();
    expect(smtp.smtpHost).toBe("platform-smtp");
    expect(smtp.smtpPort).toBe(587);
    expect(smtp.smtpFrom).toBe("platform@badge.local");
    expect(smtp.smtpUser).toBe("u");
    expect(smtp.smtpPassword).toBe("PLATFORM_PW");
    expect(smtp.smtpSecure).toBe(false);
  });
});

describe("getPlatformRecaptcha", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        recaptchaEnabled: true,
        recaptchaSiteKey: "SITE_KEY",
        recaptchaSecretKey: "SECRET_KEY",
      },
    });
  });

  it("reads reCAPTCHA directly from PlatformSettings, no cascade", async () => {
    const r = await getPlatformRecaptcha();
    expect(r.recaptchaEnabled).toBe(true);
    expect(r.recaptchaSiteKey).toBe("SITE_KEY");
    expect(r.recaptchaSecretKey).toBe("SECRET_KEY");
  });
});

describe("getPlatformPublicRecaptcha", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        recaptchaEnabled: true,
        recaptchaSiteKey: "SITE_KEY",
        recaptchaSecretKey: "SECRET_KEY",
      },
    });
  });

  it("returns enabled + site key but never the secret key", async () => {
    const r = await getPlatformPublicRecaptcha();
    expect(r.recaptchaEnabled).toBe(true);
    expect(r.recaptchaSiteKey).toBe("SITE_KEY");
    expect("recaptchaSecretKey" in r).toBe(false);
  });
});

describe("platform settings singleton missing", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
  });

  it("getPlatformSmtp throws when the singleton is absent", async () => {
    await expect(getPlatformSmtp()).rejects.toThrow(/singleton is missing/);
  });

  it("getPlatformRecaptcha throws when the singleton is absent", async () => {
    await expect(getPlatformRecaptcha()).rejects.toThrow(/singleton is missing/);
  });

  it("getPlatformPublicRecaptcha throws when the singleton is absent", async () => {
    await expect(getPlatformPublicRecaptcha()).rejects.toThrow(/singleton is missing/);
  });
});

describe("resolvePublicSettings", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: { id: "singleton" },
    });
  });

  it("never exposes SMTP nor reCAPTCHA fields", async () => {
    const s = await resolvePublicSettings();
    expect("smtpPassword" in s).toBe(false);
    expect("smtpUser" in s).toBe(false);
    expect("smtpHost" in s).toBe(false);
    expect("recaptchaEnabled" in s).toBe(false);
    expect("recaptchaSiteKey" in s).toBe(false);
    expect("recaptchaSecretKey" in s).toBe(false);
  });
});
