import { describe, it, expect } from "vitest";
import { toPaymentHistoryItem, PAYMENT_HISTORY_SELECT } from "../payment-history";

const base = {
  id: "p1",
  createdAt: new Date("2026-10-28T10:00:00Z"),
  amount: 15000,
  status: "APPROVED" as const,
  fedapayReference: "REF-1",
  plan: null,
  printRequest: null,
};

describe("toPaymentHistoryItem", () => {
  it("utilise le nom du plan comme objet", () => {
    const item = toPaymentHistoryItem({ ...base, plan: { name: "pro" } });
    expect(item.label).toBe("pro");
    expect(item).not.toHaveProperty("plan");
    expect(item).not.toHaveProperty("printRequest");
    expect(item.id).toBe("p1");
  });

  it("utilise la référence de la commande d'impression", () => {
    const item = toPaymentHistoryItem({ ...base, printRequest: { reference: "IMP-2026-0042" } });
    expect(item.label).toBe("Impression IMP-2026-0042");
  });

  it("retombe sur un tiret sans plan ni commande", () => {
    expect(toPaymentHistoryItem(base).label).toBe("—");
  });

  it("sélectionne plan et commande", () => {
    expect(PAYMENT_HISTORY_SELECT.printRequest).toEqual({ select: { reference: true } });
  });
});
