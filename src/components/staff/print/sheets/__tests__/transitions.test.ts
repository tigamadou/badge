import { describe, expect, it } from "vitest";
import { detectTransitions } from "../transitions";
import type { OrderQueueRow } from "@/lib/print-sheets/order-queue";

const row = (requestId: string, status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | null): OrderQueueRow => ({
  requestId,
  reference: `PR-${requestId}`,
  status: "PAID",
  eventId: "e1",
  eventTitle: "Salon",
  orgName: "Org",
  badgeCount: 3,
  badgePages: 1,
  paidAt: null,
  sheet: status
    ? {
        generationId: `g-${requestId}`,
        status,
        layoutName: "A4",
        duplex: false,
        badgeCount: 3,
        sheetCount: null,
        pageCount: null,
        completedAt: null,
        error: status === "FAILED" ? "boom" : null,
        downloadUrl: null,
      }
    : null,
});

describe("detectTransitions", () => {
  it("RUNNING -> DONE est prête, PENDING -> FAILED est en échec", () => {
    const prev = [row("a", "RUNNING"), row("b", "PENDING")];
    const next = [row("a", "DONE"), row("b", "FAILED")];
    const { ready, failed } = detectTransitions(prev, next);
    expect(ready.map((r) => r.requestId)).toEqual(["a"]);
    expect(failed.map((r) => r.requestId)).toEqual(["b"]);
  });

  it("une ligne inchangée ou encore active ne signale rien", () => {
    const prev = [row("a", "RUNNING"), row("b", "DONE"), row("c", "FAILED"), row("d", null)];
    const next = [row("a", "RUNNING"), row("b", "DONE"), row("c", "FAILED"), row("d", null)];
    expect(detectTransitions(prev, next)).toEqual({ ready: [], failed: [] });
  });

  it("une ligne absente avant, ou qui n'était pas active (échec relancé, aucune planche), ne signale rien", () => {
    const prev = [row("a", "FAILED"), row("b", null)];
    const next = [row("a", "DONE"), row("b", "DONE"), row("c", "DONE")];
    expect(detectTransitions(prev, next)).toEqual({ ready: [], failed: [] });
  });
});
