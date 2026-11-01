import { describe, it, expect } from "vitest";
import {
  SUBSCRIPTION_RIGHTS,
  DEFAULT_RIGHTS,
  parseRights,
  isEventOngoing,
  can,
  type OrgAccess,
  type EventTiming,
} from "@/lib/subscription-rights";

function access(active: boolean, rights = DEFAULT_RIGHTS): OrgAccess {
  return { active, maxEvents: null, maxParticipantsPerEvent: null, rights };
}

const today = new Date("2026-11-01T00:00:00Z");

describe("DEFAULT_RIGHTS", () => {
  it("reprend les défauts de la spec", () => {
    expect(DEFAULT_RIGHTS).toEqual({
      CREATE_EVENT: { active: true, inactive: false },
      RECEIVE_REGISTRATIONS: { active: true, inactive: true },
      MANAGE_ONGOING_EVENTS: { active: true, inactive: true },
      ACCESS_ORG_SPACE: { active: true, inactive: false },
    });
  });
});

describe("parseRights", () => {
  it.each([null, undefined, "x", [], 42])("renvoie les défauts pour %j", (raw) => {
    expect(parseRights(raw)).toEqual(DEFAULT_RIGHTS);
  });

  it("fusionne champ par champ et ignore clés inconnues et valeurs non booléennes", () => {
    const parsed = parseRights({
      CREATE_EVENT: { inactive: true },
      FOO: {},
      ACCESS_ORG_SPACE: { active: "oui" },
    });
    expect(parsed.CREATE_EVENT).toEqual({ active: true, inactive: true });
    expect(parsed.ACCESS_ORG_SPACE).toEqual({ active: true, inactive: false });
    expect(parsed).not.toHaveProperty("FOO");
    expect(Object.keys(parsed)).toEqual([...SUBSCRIPTION_RIGHTS]);
  });

  it("ne partage pas d'objet avec les défauts", () => {
    const parsed = parseRights(null);
    parsed.CREATE_EVENT.inactive = true;
    expect(DEFAULT_RIGHTS.CREATE_EVENT.inactive).toBe(false);
  });
});

describe("isEventOngoing", () => {
  const base: EventTiming = { date: today, endDate: null, archived: false };

  it("un évènement d'un jour est en cours jusqu'à 23 h UTC le jour même", () => {
    expect(isEventOngoing(base, new Date("2026-11-01T23:00:00Z"))).toBe(true);
  });
  it("l'est encore à 23:59:59.999 UTC le jour même", () => {
    expect(isEventOngoing(base, new Date("2026-11-01T23:59:59.999Z"))).toBe(true);
  });
  it("ne l'est plus le lendemain à 00:00 UTC", () => {
    expect(isEventOngoing(base, new Date("2026-11-02T00:00:00Z"))).toBe(false);
  });
  it("un évènement archivé n'est pas en cours", () => {
    expect(isEventOngoing({ ...base, archived: true }, new Date("2026-11-01T10:00:00Z"))).toBe(false);
  });
  it("date passée et endDate future : en cours", () => {
    const ev = { date: new Date("2026-10-01T00:00:00Z"), endDate: new Date("2026-11-05T12:00:00Z"), archived: false };
    expect(isEventOngoing(ev, new Date("2026-11-05T20:00:00Z"))).toBe(true);
    expect(isEventOngoing(ev, new Date("2026-11-06T00:00:00Z"))).toBe(false);
  });
  it("un évènement à venir est en cours", () => {
    expect(isEventOngoing({ ...base, date: new Date("2026-12-01T00:00:00Z") }, new Date("2026-11-01T10:00:00Z"))).toBe(true);
  });
});

describe("can", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  const ongoing: EventTiming = { date: today, endDate: null, archived: false };
  const finished: EventTiming = { date: new Date("2026-10-01T00:00:00Z"), endDate: null, archived: false };

  it("actif + défauts : tout est permis, même sur un évènement terminé", () => {
    for (const right of SUBSCRIPTION_RIGHTS) expect(can(access(true), right, undefined, now)).toBe(true);
    expect(can(access(true), "MANAGE_ONGOING_EVENTS", finished, now)).toBe(true);
  });

  it("actif + CREATE_EVENT.active = false : refusé", () => {
    const rights = parseRights({ CREATE_EVENT: { active: false } });
    expect(can(access(true, rights), "CREATE_EVENT")).toBe(false);
  });

  it("inactif + défauts : création et espace org refusés", () => {
    expect(can(access(false), "CREATE_EVENT")).toBe(false);
    expect(can(access(false), "ACCESS_ORG_SPACE")).toBe(false);
  });

  it("inactif : droits évènement exigent un évènement en cours", () => {
    expect(can(access(false), "MANAGE_ONGOING_EVENTS", ongoing, now)).toBe(true);
    expect(can(access(false), "MANAGE_ONGOING_EVENTS", finished, now)).toBe(false);
    expect(can(access(false), "MANAGE_ONGOING_EVENTS", undefined, now)).toBe(false);
    expect(can(access(false), "RECEIVE_REGISTRATIONS", ongoing, now)).toBe(true);
    expect(can(access(false), "RECEIVE_REGISTRATIONS", finished, now)).toBe(false);
  });

  it("inactif : un droit désactivé reste refusé même en cours", () => {
    const rights = parseRights({ MANAGE_ONGOING_EVENTS: { inactive: false } });
    expect(can(access(false, rights), "MANAGE_ONGOING_EVENTS", ongoing, now)).toBe(false);
  });

  it("inactif : CREATE_EVENT activé n'exige pas d'évènement", () => {
    const rights = parseRights({ CREATE_EVENT: { inactive: true } });
    expect(can(access(false, rights), "CREATE_EVENT")).toBe(true);
  });
});
