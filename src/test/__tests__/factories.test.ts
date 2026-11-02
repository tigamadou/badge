import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeCategory,
  makeEvent,
  makeInstalledTemplate,
  makeOrg,
  makePrintLayout,
  makePrintOrder,
  makeRegistration,
  makeStaff,
  makeUser,
  seedFactories,
} from "@/test/factories";

describe("fabriques de test", () => {
  it("créent une chaîne complète en base, avec des valeurs uniques", async () => {
    seedFactories(1);
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const cat1 = await makeCategory(event.id);
    const cat2 = await makeCategory(event.id);
    const reg = await makeRegistration(event.id, cat1.id, "PENDING");
    const template = await makeInstalledTemplate(staff.id, { pages: 2 });
    const layout = await makePrintLayout();
    const order = await makePrintOrder({ eventId: event.id, orgId: org.id, status: "PAID" });

    expect(staff).toMatchObject({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect([cat1.number, cat2.number]).toEqual([1, 2]);
    expect(reg).toMatchObject({ eventId: event.id, categoryId: cat1.id, status: "PENDING" });
    expect(template.pages).toBe(2);
    expect(layout.gapHorizontal).toBe(50);
    expect(order).toMatchObject({ status: "PAID", type: "ADVANCE" });
    expect(await prisma.user.count()).toBe(2);

    const [a, b] = [await makeUser(), await makeUser()];
    expect(a.email).not.toBe(b.email);
  });

  it("acceptent des surcharges", async () => {
    const user = await makeUser({ name: "Awa Diallo" });
    const org = await makeOrg({ name: "Acme" });
    expect(user.name).toBe("Awa Diallo");
    expect(org.name).toBe("Acme");
  });
});
