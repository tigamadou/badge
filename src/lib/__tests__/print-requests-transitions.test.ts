import type { PrintRequestStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  nextStatus,
  type PrintRequestAction,
  type PrintRequestActor,
} from "@/lib/print-requests/transitions";

const STATUSES: PrintRequestStatus[] = [
  "DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED", "PAID",
  "IN_PRODUCTION", "READY", "COMPLETED", "REJECTED", "CANCELLED",
];
const ACTIONS: PrintRequestAction[] = [
  "SUBMIT", "ORGANIZER_EDIT", "STAFF_EDIT", "SEND_QUOTE", "ACCEPT", "REOPEN", "REJECT",
  "CANCEL", "MARK_PAID", "START_PRODUCTION", "MARK_READY", "COMPLETE", "TEMPLATE_CHANGED",
];
const ACTORS: PrintRequestActor[] = ["ORGANIZER", "STAFF", "SYSTEM"];

// [départ, action, acteur, arrivée] : une ligne par combinaison de la table (24).
const ALLOWED: [PrintRequestStatus, PrintRequestAction, PrintRequestActor, PrintRequestStatus][] = [
  ["DRAFT", "SUBMIT", "ORGANIZER", "SUBMITTED"],
  ["DRAFT", "ORGANIZER_EDIT", "ORGANIZER", "DRAFT"],
  ["SUBMITTED", "ORGANIZER_EDIT", "ORGANIZER", "SUBMITTED"],
  ["QUOTED", "ORGANIZER_EDIT", "ORGANIZER", "SUBMITTED"],
  ["SUBMITTED", "STAFF_EDIT", "STAFF", "SUBMITTED"],
  ["QUOTED", "STAFF_EDIT", "STAFF", "SUBMITTED"],
  ["SUBMITTED", "SEND_QUOTE", "STAFF", "QUOTED"],
  ["QUOTED", "ACCEPT", "ORGANIZER", "ACCEPTED"],
  ["ACCEPTED", "REOPEN", "STAFF", "SUBMITTED"],
  ["SUBMITTED", "REJECT", "STAFF", "REJECTED"],
  ["QUOTED", "REJECT", "STAFF", "REJECTED"],
  ["DRAFT", "CANCEL", "ORGANIZER", "CANCELLED"],
  ["SUBMITTED", "CANCEL", "ORGANIZER", "CANCELLED"],
  ["QUOTED", "CANCEL", "ORGANIZER", "CANCELLED"],
  ["ACCEPTED", "CANCEL", "ORGANIZER", "CANCELLED"],
  ["ACCEPTED", "MARK_PAID", "SYSTEM", "PAID"],
  ["ACCEPTED", "MARK_PAID", "STAFF", "PAID"],
  ["PAID", "START_PRODUCTION", "STAFF", "IN_PRODUCTION"],
  ["IN_PRODUCTION", "MARK_READY", "STAFF", "READY"],
  ["READY", "COMPLETE", "STAFF", "COMPLETED"],
  ["DRAFT", "TEMPLATE_CHANGED", "SYSTEM", "DRAFT"],
  ["SUBMITTED", "TEMPLATE_CHANGED", "SYSTEM", "SUBMITTED"],
  ["QUOTED", "TEMPLATE_CHANGED", "SYSTEM", "SUBMITTED"],
  ["ACCEPTED", "TEMPLATE_CHANGED", "SYSTEM", "SUBMITTED"],
];

describe("nextStatus", () => {
  it.each(ALLOWED)("%s + %s par %s -> %s", (from, action, actor, to) => {
    expect(nextStatus(from, action, actor)).toBe(to);
  });

  it("les 24 combinaisons de la table, et elles seules, sont permises", () => {
    const expected = new Map(ALLOWED.map(([f, a, w, t]) => [`${f}|${a}|${w}`, t]));
    expect(expected.size).toBe(24);
    let count = 0;
    for (const s of STATUSES)
      for (const a of ACTIONS)
        for (const w of ACTORS) {
          const got = nextStatus(s, a, w);
          expect(got).toBe(expected.get(`${s}|${a}|${w}`) ?? null);
          if (got !== null) count++;
        }
    expect(count).toBe(24);
  });

  it("DRAFT + SUBMIT par ORGANIZER -> SUBMITTED ; par STAFF -> null", () => {
    expect(nextStatus("DRAFT", "SUBMIT", "ORGANIZER")).toBe("SUBMITTED");
    expect(nextStatus("DRAFT", "SUBMIT", "STAFF")).toBeNull();
  });
  it("QUOTED + STAFF_EDIT -> SUBMITTED (le devis repasse en révision)", () => {
    expect(nextStatus("QUOTED", "STAFF_EDIT", "STAFF")).toBe("SUBMITTED");
  });
  it("ACCEPTED + STAFF_EDIT -> null : il faut rouvrir", () => {
    expect(nextStatus("ACCEPTED", "STAFF_EDIT", "STAFF")).toBeNull();
  });
  it("ACCEPTED + MARK_PAID par SYSTEM et par STAFF -> PAID ; par ORGANIZER -> null", () => {
    expect(nextStatus("ACCEPTED", "MARK_PAID", "SYSTEM")).toBe("PAID");
    expect(nextStatus("ACCEPTED", "MARK_PAID", "STAFF")).toBe("PAID");
    expect(nextStatus("ACCEPTED", "MARK_PAID", "ORGANIZER")).toBeNull();
  });
  it("COMPLETED, REJECTED, CANCELLED n'ont aucune sortie", () => {
    for (const s of ["COMPLETED", "REJECTED", "CANCELLED"] as const)
      for (const a of ACTIONS)
        for (const w of ACTORS) expect(nextStatus(s, a, w)).toBeNull();
  });
  it("PAID + CANCEL -> null", () => {
    expect(nextStatus("PAID", "CANCEL", "ORGANIZER")).toBeNull();
  });
});
