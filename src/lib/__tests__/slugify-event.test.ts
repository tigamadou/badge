import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { slugifyEvent, uniqueEventSlug } from "@/lib/slugify-event";

describe("slugifyEvent", () => {
  it("normalizes accents and case", () => {
    expect(slugifyEvent("Conférence À Paris")).toBe("conference-a-paris");
  });
  it("strips punctuation and special chars", () => {
    expect(slugifyEvent("Hello, World! / 2026")).toBe("hello-world-2026");
  });
  it("collapses spaces and trims dashes", () => {
    expect(slugifyEvent("  Multi   Space  ")).toBe("multi-space");
  });
  it("preserves digits", () => {
    expect(slugifyEvent("Edition 2026 Paris")).toBe("edition-2026-paris");
  });
});

describe("uniqueEventSlug", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("returns base slug if no collision", async () => {
    const slug = await uniqueEventSlug("Conférence Paris");
    expect(slug).toBe("conference-paris");
  });

  it("appends -2 on collision", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-uniq" } });
    await prisma.event.create({
      data: {
        orgId: org.id,
        title: "T",
        slug: "conference-paris",
        location: "",
        date: new Date(),
      },
    });
    const slug = await uniqueEventSlug("Conférence Paris");
    expect(slug).toBe("conference-paris-2");
  });

  it("appends -3 if -2 already taken", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-uniq2" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "x", location: "", date: new Date() },
    });
    await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "x-2", location: "", date: new Date() },
    });
    const slug = await uniqueEventSlug("X");
    expect(slug).toBe("x-3");
  });
});
