import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeEvent, makeOrg, makePayment, makePlan } from "@/test/factories";

describe("fabriques retours client", () => {
  it("makeEvent : champs d'image, nuls par defaut et surchargeables", async () => {
    const org = await makeOrg();
    const plain = await prisma.event.findUniqueOrThrow({ where: { id: (await makeEvent(org.id)).id } });
    expect([
      plain.logoOriginal,
      plain.bannerOriginal,
      plain.logoWidth,
      plain.logoHeight,
      plain.bannerWidth,
      plain.bannerHeight,
    ]).toEqual([null, null, null, null, null, null]);

    const ev = await makeEvent(org.id, { logoOriginal: "uploads/o.png", logoWidth: 1500, logoHeight: 500 });
    const read = await prisma.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect([read.logoOriginal, read.logoWidth, read.logoHeight]).toEqual(["uploads/o.png", 1500, 500]);
  });

  it("makePlan : valeurs par defaut et surcharges", async () => {
    const plan = await makePlan();
    expect(plan.name).toBeTruthy();
    expect(plan.publicVisible).toBe(false);
    expect(plan.position).toBe(0);
    expect(plan.highlighted).toBe(false);
    expect(plan.features).toBeNull();

    const custom = await makePlan({ publicVisible: true, features: ["A", "B"], price: 15000 });
    const read = await prisma.plan.findUniqueOrThrow({ where: { id: custom.id } });
    expect(read.publicVisible).toBe(true);
    expect(read.features).toEqual(["A", "B"]);
    expect(read.price).toBe(15000);
    expect(custom.name).not.toBe(plan.name);
  });

  it("makePayment : valeurs par defaut et champs de prorata", async () => {
    const org = await makeOrg();
    const plan = await makePlan();
    const p = await makePayment(org.id, { planId: plan.id });
    expect(p.status).toBe("PENDING");
    expect(p.purpose).toBe("SUBSCRIPTION");
    expect(p.amount).toBeGreaterThan(0);
    expect([p.listPrice, p.prorataCredit, p.coversFrom, p.coversTo]).toEqual([null, null, null, null]);

    const coversFrom = new Date("2026-01-01T00:00:00Z");
    const coversTo = new Date("2026-01-31T00:00:00Z");
    const q = await makePayment(org.id, {
      planId: plan.id,
      coversFrom,
      coversTo,
      listPrice: 15000,
      prorataCredit: 3000,
      amount: 12000,
    });
    const read = await prisma.payment.findUniqueOrThrow({ where: { id: q.id } });
    expect([read.listPrice, read.prorataCredit, read.amount]).toEqual([15000, 3000, 12000]);
    expect(read.coversFrom).toEqual(coversFrom);
    expect(read.coversTo).toEqual(coversTo);
  });
});
