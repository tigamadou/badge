import { describe, expect, it } from "vitest";
import { listPublicPlans } from "@/lib/public-plans";
import { makeBillingPlan } from "@/test/factories-billing";

describe("listPublicPlans", () => {
  it("exclut les plans archivés et non visibles", async () => {
    const visible = await makeBillingPlan({ publicVisible: true });
    await makeBillingPlan({ publicVisible: true, archived: true });
    await makeBillingPlan({ publicVisible: false });
    const plans = await listPublicPlans();
    expect(plans.map((p) => p.id)).toEqual([visible.id]);
  });

  it("trie par position, puis prix, puis identifiant", async () => {
    const late = await makeBillingPlan({ publicVisible: true, position: 20, price: 1000 });
    const dear = await makeBillingPlan({ publicVisible: true, position: 10, price: 9000 });
    const cheap = await makeBillingPlan({ publicVisible: true, position: 10, price: 5000 });
    expect((await listPublicPlans()).map((p) => p.id)).toEqual([cheap.id, dear.id, late.id]);
  });

  it("features invalides (objet, nombres, vides) deviennent une liste vide ou filtrée ; description nulle conservée", async () => {
    const obj = await makeBillingPlan({ publicVisible: true, position: 1, features: { a: 1 } });
    const nums = await makeBillingPlan({ publicVisible: true, position: 2, features: [1, 2] });
    const mixed = await makeBillingPlan({ publicVisible: true, position: 3, features: ["  A  ", "", "  ", 3, "B"] });
    const none = await makeBillingPlan({ publicVisible: true, position: 4 });
    const byId = new Map((await listPublicPlans()).map((p) => [p.id, p]));
    expect(byId.get(obj.id)?.features).toEqual([]);
    expect(byId.get(nums.id)?.features).toEqual([]);
    expect(byId.get(mixed.id)?.features).toEqual(["A", "B"]);
    expect(byId.get(none.id)).toMatchObject({ features: [], description: null, highlighted: false });
  });

  it("renvoie les champs publics", async () => {
    const p = await makeBillingPlan({
      publicVisible: true, description: "Court", highlighted: true, maxEvents: null, maxParticipantsPerEvent: 50, price: null,
    });
    const found = (await listPublicPlans()).find((x) => x.id === p.id);
    expect(found).toMatchObject({
      name: p.name, period: "MONTHLY", price: null, maxEvents: null, maxParticipantsPerEvent: 50, description: "Court", highlighted: true,
    });
  });
});
