import { describe, it, expect } from "vitest";
import { resolveRecipients } from "../recipients";
import { addEventMember, addOrgMember, makeEvent, makeOrg, makeUser } from "./helpers";
import { makeCustomRole, makeEventMember, makeOrgMember, makeOverride, makeStaff } from "@/test/factories";
import { prisma } from "@/lib/prisma";

const ids = (r: { id: string }[]) => r.map((x) => x.id).sort();

describe("resolveRecipients", () => {
  it("users : renvoie les utilisateurs existants, ignore les ids inconnus", async () => {
    const u = await makeUser({ name: "Awa" });
    const res = await resolveRecipients({ users: [u.id, "inconnu"] }, {});
    expect(res).toEqual([{ id: u.id, email: u.email, name: "Awa" }]);
  });

  describe("cible platform", () => {
    it("profiles.review : SA, AD, SU ; pas OB ni PR ni non-staff", async () => {
      const sa = await makeStaff("SUPER_ADMIN");
      const ad = await makeStaff("STAFF_ADMIN");
      const su = await makeStaff("STAFF_SUPPORT");
      await makeStaff("STAFF_OBSERVER");
      await makeStaff("STAFF_PRINTER");
      await makeUser();
      const res = await resolveRecipients({ permission: "profiles.review", target: { kind: "platform" } }, {});
      expect(ids(res)).toEqual(ids([sa, ad, su]));
    });

    it("print.requests.messages.send : SA, AD, PR ; pas SU", async () => {
      const sa = await makeStaff("SUPER_ADMIN");
      const ad = await makeStaff("STAFF_ADMIN");
      const pr = await makeStaff("STAFF_PRINTER");
      await makeStaff("STAFF_SUPPORT");
      const res = await resolveRecipients(
        { permission: "print.requests.messages.send", target: { kind: "platform" } },
        {},
      );
      expect(ids(res)).toEqual(ids([sa, ad, pr]));
    });

    it("un GRANT plateforme donne la permission à un non-staff", async () => {
      const u = await makeUser();
      await makeOverride({ userId: u.id, permission: "profiles.review", effect: "GRANT" });
      const res = await resolveRecipients({ permission: "profiles.review", target: { kind: "platform" } }, {});
      expect(ids(res)).toEqual([u.id]);
    });

    it("un REVOKE plateforme retire la permission à un staff", async () => {
      const su = await makeStaff("STAFF_SUPPORT");
      await makeOverride({ userId: su.id, permission: "profiles.review", effect: "REVOKE" });
      expect(await resolveRecipients({ permission: "profiles.review", target: { kind: "platform" } }, {})).toEqual([]);
    });

    it("exclut les comptes archivés ou bloqués, l'auteur et excludeUserIds ; ordre par id sans doublon", async () => {
      const a = await makeStaff("STAFF_ADMIN");
      await makeStaff("STAFF_ADMIN", { archived: true });
      await makeStaff("STAFF_ADMIN", { blocked: true });
      const c = await makeStaff("STAFF_ADMIN");
      const d = await makeStaff("STAFF_ADMIN");
      const e = await makeStaff("STAFF_ADMIN");
      // c cumule rôle staff et ajustement : une seule ligne
      await makeOverride({ userId: c.id, permission: "profiles.review", effect: "GRANT" });
      const res = await resolveRecipients(
        { permission: "profiles.review", target: { kind: "platform" } },
        { actorId: a.id, excludeUserIds: [d.id] },
      );
      expect(res.map((r) => r.id)).toEqual([c.id, e.id].sort());
    });

    it("staff replié sur l'enum (staffRole sans platformRoleId) résolu", async () => {
      const u = await makeUser({ staffRole: "STAFF_SUPPORT" });
      const res = await resolveRecipients({ permission: "profiles.review", target: { kind: "platform" } }, {});
      expect(ids(res)).toEqual([u.id]);
    });
  });

  describe("cible event", () => {
    it("registration.approve : ADMIN/OPERATOR d'évènement et OWNER/MANAGER d'org ; pas AUDITOR, AGENT, PRINTER, VIEWER ni staff non membre", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const owner = await makeOrgMember(org.id, "OWNER");
      const manager = await makeOrgMember(org.id, "MANAGER");
      await makeOrgMember(org.id, "AUDITOR");
      await makeOrgMember(org.id, "AGENT");
      const admin = await makeEventMember(ev.id, "ADMIN");
      const operator = await makeEventMember(ev.id, "OPERATOR");
      await makeEventMember(ev.id, "PRINTER");
      await makeEventMember(ev.id, "VIEWER");
      await makeStaff("SUPER_ADMIN");
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual(ids([owner, manager, admin, operator]));
    });

    it("includeStaff ajoute SA, AD, SU porteurs de la permission", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const owner = await makeOrgMember(org.id, "OWNER");
      const sa = await makeStaff("SUPER_ADMIN");
      const ad = await makeStaff("STAFF_ADMIN");
      const su = await makeStaff("STAFF_SUPPORT");
      await makeStaff("STAFF_OBSERVER");
      const res = await resolveRecipients(
        {
          permission: "registration.approve",
          target: { kind: "event", eventId: ev.id, orgId: org.id },
          includeStaff: true,
        },
        {},
      );
      expect(ids(res)).toEqual(ids([owner, sa, ad, su]));
    });

    it("un membre d'une autre organisation est exclu", async () => {
      const org = await makeOrg();
      const other = await makeOrg();
      const ev = await makeEvent(org.id);
      await makeOrgMember(other.id, "OWNER");
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(res).toEqual([]);
    });

    it("un GRANT d'une autre organisation et un membre d'un autre évènement sont exclus", async () => {
      const org = await makeOrg();
      const other = await makeOrg();
      const ev = await makeEvent(org.id);
      const otherEv = await makeEvent(org.id);
      const granted = await makeUser();
      await makeOverride({ userId: granted.id, orgId: other.id, permission: "registration.approve", effect: "GRANT" });
      await makeEventMember(otherEv.id, "ADMIN");
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(res).toEqual([]);
    });

    it("un staff membre AUDITOR n'est pas notifié par son rôle plateforme sans includeStaff, il l'est avec", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const ad = await makeOrgMember(org.id, "AUDITOR", { isStaff: true, staffRole: "STAFF_ADMIN" });
      const target = { kind: "event", eventId: ev.id, orgId: org.id } as const;
      expect(await resolveRecipients({ permission: "registration.approve", target }, {})).toEqual([]);
      const withStaff = await resolveRecipients({ permission: "registration.approve", target, includeStaff: true }, {});
      expect(ids(withStaff)).toEqual([ad.id]);
    });

    it("un OWNER d'org également ADMIN de l'évènement n'apparaît qu'une fois", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const owner = await makeOrgMember(org.id, "OWNER");
      await prisma.eventMembership.create({
        data: { userId: owner.id, eventId: ev.id, role: "ADMIN" },
      });
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual([owner.id]);
    });

    it("rôle personnalisé d'évènement et ajustement d'organisation pris en compte", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const role = await makeCustomRole({ scope: "EVENT", orgId: org.id, permissions: ["registration.approve"] });
      const holder = await makeUser();
      await prisma.eventMembership.create({ data: { userId: holder.id, eventId: ev.id, roleId: role.id } });
      const granted = await makeUser();
      await makeOverride({ userId: granted.id, orgId: org.id, permission: "registration.approve", effect: "GRANT" });
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual(ids([holder, granted]));
    });

    it("membres repliés sur l'enum (sans roleId) correctement résolus", async () => {
      const org = await makeOrg();
      const ev = await makeEvent(org.id);
      const owner = await makeUser();
      const admin = await makeUser();
      await addOrgMember(owner.id, org.id, "OWNER");
      await addEventMember(admin.id, ev.id, "ADMIN");
      const res = await resolveRecipients(
        { permission: "registration.approve", target: { kind: "event", eventId: ev.id, orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual(ids([owner, admin]));
    });
  });

  describe("cible org", () => {
    it("billing.subscription.pay : OWNER seulement, pas le staff non membre", async () => {
      const org = await makeOrg();
      const owner = await makeOrgMember(org.id, "OWNER");
      await makeOrgMember(org.id, "MANAGER");
      await makeOrgMember(org.id, "AUDITOR");
      await makeStaff("SUPER_ADMIN");
      const res = await resolveRecipients(
        { permission: "billing.subscription.pay", target: { kind: "org", orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual([owner.id]);
    });

    it("un SUPER_ADMIN membre AGENT n'est pas notifié de la facturation", async () => {
      const org = await makeOrg();
      const owner = await makeOrgMember(org.id, "OWNER");
      await makeOrgMember(org.id, "AGENT", { isStaff: true, staffRole: "SUPER_ADMIN" });
      const res = await resolveRecipients(
        { permission: "billing.subscription.pay", target: { kind: "org", orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual([owner.id]);
    });

    it("un GRANT d'une autre organisation n'ajoute personne", async () => {
      const org = await makeOrg();
      const other = await makeOrg();
      const granted = await makeUser();
      await makeOverride({ userId: granted.id, orgId: other.id, permission: "billing.subscription.pay", effect: "GRANT" });
      const res = await resolveRecipients(
        { permission: "billing.subscription.pay", target: { kind: "org", orgId: org.id } },
        {},
      );
      expect(res).toEqual([]);
    });

    it("OWNER replié sur l'enum résolu", async () => {
      const org = await makeOrg();
      const owner = await makeUser();
      await addOrgMember(owner.id, org.id, "OWNER");
      const res = await resolveRecipients(
        { permission: "billing.subscription.pay", target: { kind: "org", orgId: org.id } },
        {},
      );
      expect(ids(res)).toEqual([owner.id]);
    });
  });

  it("membership sans rôle ni roleId : ignoré", async () => {
    const org = await makeOrg();
    const u = await makeUser();
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id } });
    const res = await resolveRecipients(
      { permission: "billing.subscription.pay", target: { kind: "org", orgId: org.id } },
      {},
    );
    expect(res).toEqual([]);
  });

  it("users : exclut l'auteur, les comptes bloqués et archivés, et excludeUserIds", async () => {
    const a = await makeUser();
    const b = await makeUser({ blocked: true });
    const c = await makeUser({ archived: true });
    const d = await makeUser();
    const e = await makeUser();
    const res = await resolveRecipients(
      { users: [a.id, b.id, c.id, d.id, e.id] },
      { actorId: a.id, excludeUserIds: [d.id] },
    );
    expect(ids(res)).toEqual([e.id]);
  });
});
