import type { OrderQueueRow } from "@/lib/print-sheets/order-queue";

const isActive = (r: OrderQueueRow) => r.sheet?.status === "PENDING" || r.sheet?.status === "RUNNING";

// Lignes dont la planche était en attente ou en cours et vient de se terminer (prête ou en échec).
export function detectTransitions(
  prev: OrderQueueRow[],
  next: OrderQueueRow[],
): { ready: OrderQueueRow[]; failed: OrderQueueRow[] } {
  const before = new Map(prev.map((r) => [r.requestId, r]));
  const ready: OrderQueueRow[] = [];
  const failed: OrderQueueRow[] = [];
  for (const row of next) {
    const old = before.get(row.requestId);
    if (!old || !isActive(old)) continue;
    if (row.sheet?.status === "DONE") ready.push(row);
    else if (row.sheet?.status === "FAILED") failed.push(row);
  }
  return { ready, failed };
}
