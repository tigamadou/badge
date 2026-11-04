import { describe, expect, it } from "vitest";
import { entryTone, toneClasses } from "../entry-tone";

describe("entryTone", () => {
  it("couvre les 5 tons", () => {
    expect(entryTone({ side: "ORGANIZER", kind: "MESSAGE", eventType: null }, "STAFF")).toBe("client");
    expect(entryTone({ side: "STAFF", kind: "MESSAGE", eventType: null }, "ORGANIZER")).toBe("staff");
    expect(entryTone({ side: "SYSTEM", kind: "EVENT", eventType: "QUOTE_SENT" }, "STAFF")).toBe("quote");
    expect(entryTone({ side: "STAFF", kind: "MESSAGE", eventType: null, internal: true }, "STAFF")).toBe("internal");
    expect(entryTone({ side: "SYSTEM", kind: "EVENT", eventType: "PAYMENT_RECEIVED" }, "STAFF")).toBe("event");
  });

  it("le récapitulatif de devis est teinté comme le devis", () => {
    const body = "Devis v1 : 1 ligne(s)\n• Ligne ajoutée : A\nTotal : 1 FCFA";
    expect(entryTone({ side: "STAFF", kind: "MESSAGE", eventType: null, body }, "ORGANIZER")).toBe("quote");
    expect(entryTone({ side: "STAFF", kind: "MESSAGE", eventType: null, body: "Salut" }, "ORGANIZER")).toBe("staff");
  });

  it("expose une classe par ton", () => {
    expect(Object.keys(toneClasses).sort()).toEqual(["client", "event", "internal", "quote", "staff"]);
    expect(toneClasses.client).toContain("bg-slate-100");
    expect(toneClasses.staff).toContain("bg-turquoise-soft");
    expect(toneClasses.staff).toContain("ring-turquoise-strong/20");
    expect(toneClasses.quote).toContain("bg-mist");
    expect(toneClasses.quote).toContain("ring-line");
    expect(toneClasses.internal).toContain("bg-gold-soft");
    expect(toneClasses.internal).toContain("text-gold-strong");
  });
});
