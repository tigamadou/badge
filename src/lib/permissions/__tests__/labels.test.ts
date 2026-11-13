import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "../catalog";
import { DOMAIN_LABELS, domainOf, groupByDomain } from "../labels";

describe("DOMAIN_LABELS", () => {
  it("a un libellé pour chaque domaine du catalogue", () => {
    for (const p of PERMISSION_CATALOG) {
      expect(DOMAIN_LABELS[p.domain]).toBeTruthy();
    }
  });
});

describe("domainOf", () => {
  it("renvoie le domaine de la permission", () => {
    expect(domainOf("print.requests.read")).toBe("print_requests");
    expect(domainOf("org.events.archive")).toBe("events");
  });
});

describe("groupByDomain", () => {
  it("regroupe par domaine en conservant l'ordre du catalogue", () => {
    const groups = groupByDomain(["scan.check-in", "platform.access", "scan.history.read", "event.update"]);
    expect(groups.map((g) => g.domain)).toEqual(["access", "events", "scan"]);
    expect(groups[2].label).toBe(DOMAIN_LABELS.scan);
    expect(groups[2].permissions.map((p) => p.key)).toEqual(["scan.history.read", "scan.check-in"]);
  });

  it("renvoie une liste vide sans permission", () => {
    expect(groupByDomain([])).toEqual([]);
  });
});
