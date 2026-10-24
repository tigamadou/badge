import { describe, it, expect } from "vitest";
import { resolveRecipients } from "../recipients";
import { addEventMember, addOrgMember, makeEvent, makeOrg, makeUser } from "./helpers";

const ids = (r: { id: string }[]) => r.map((x) => x.id).sort();

describe("resolveRecipients", () => {
  it("users : renvoie les utilisateurs existants, ignore les ids inconnus", async () => {
    const u = await makeUser({ name: "Awa" });
    const res = await resolveRecipients({ users: [u.id, "inconnu"] }, {});
    expect(res).toEqual([{ id: u.id, email: u.email, name: "Awa" }]);
  });

  it("eventRoles ADMIN+OPERATOR inclut OWNER et MANAGER de l'org, exclut AUDITOR, PRINTER, VIEWER", async () => {
    const org = await makeOrg();
    const ev = await makeEvent(org.id);
    const [owner, manager, auditor, admin, operator, printer, viewer] = await Promise.all(
      Array.from({ length: 7 }, () => makeUser()),
    );
    await addOrgMember(owner.id, org.id, "OWNER");
    await addOrgMember(manager.id, org.id, "MANAGER");
    await addOrgMember(auditor.id, org.id, "AUDITOR");
    await addEventMember(admin.id, ev.id, "ADMIN");
    await addEventMember(operator.id, ev.id, "OPERATOR");
    await addEventMember(printer.id, ev.id, "PRINTER");
    await addEventMember(viewer.id, ev.id, "VIEWER");
    const res = await resolveRecipients({ eventRoles: { eventId: ev.id, roles: ["ADMIN", "OPERATOR"] } }, {});
    expect(ids(res)).toEqual(ids([owner, manager, admin, operator]));
  });

  it("eventRoles : un OWNER d'org également ADMIN de l'évènement n'apparaît qu'une fois", async () => {
    const org = await makeOrg();
    const ev = await makeEvent(org.id);
    const u = await makeUser();
    await addOrgMember(u.id, org.id, "OWNER");
    await addEventMember(u.id, ev.id, "ADMIN");
    const res = await resolveRecipients({ eventRoles: { eventId: ev.id, roles: ["ADMIN"] } }, {});
    expect(ids(res)).toEqual([u.id]);
  });

  it("eventRoles avec les quatre rôles inclut l'AUDITOR (hérité VIEWER) et le PRINTER", async () => {
    const org = await makeOrg();
    const ev = await makeEvent(org.id);
    const auditor = await makeUser();
    const printer = await makeUser();
    await addOrgMember(auditor.id, org.id, "AUDITOR");
    await addEventMember(printer.id, ev.id, "PRINTER");
    const res = await resolveRecipients(
      { eventRoles: { eventId: ev.id, roles: ["ADMIN", "OPERATOR", "PRINTER", "VIEWER"] } },
      {},
    );
    expect(ids(res)).toEqual(ids([auditor, printer]));
  });

  it("un staff non membre ne reçoit pas les notifications d'évènement", async () => {
    const org = await makeOrg();
    const ev = await makeEvent(org.id);
    await makeUser({ staffRole: "SUPER_ADMIN" });
    const res = await resolveRecipients(
      { eventRoles: { eventId: ev.id, roles: ["ADMIN", "OPERATOR", "PRINTER", "VIEWER"] } },
      {},
    );
    expect(res).toEqual([]);
  });

  it("un staff membre ADMIN de l'évènement les reçoit", async () => {
    const org = await makeOrg();
    const ev = await makeEvent(org.id);
    const staff = await makeUser({ staffRole: "STAFF_OBSERVER" });
    await addEventMember(staff.id, ev.id, "ADMIN");
    const res = await resolveRecipients({ eventRoles: { eventId: ev.id, roles: ["ADMIN"] } }, {});
    expect(ids(res)).toEqual([staff.id]);
  });

  it("staffMinRole STAFF_SUPPORT inclut SUPPORT, ADMIN, SUPER_ADMIN et exclut OBSERVER et les non-staff", async () => {
    const support = await makeUser({ staffRole: "STAFF_SUPPORT" });
    const admin = await makeUser({ staffRole: "STAFF_ADMIN" });
    const sa = await makeUser({ staffRole: "SUPER_ADMIN" });
    await makeUser({ staffRole: "STAFF_OBSERVER" });
    await makeUser();
    const res = await resolveRecipients({ staffMinRole: "STAFF_SUPPORT" }, {});
    expect(ids(res)).toEqual(ids([support, admin, sa]));
  });

  it("orgRoles OWNER n'inclut que les OWNER", async () => {
    const org = await makeOrg();
    const owner = await makeUser();
    const manager = await makeUser();
    await addOrgMember(owner.id, org.id, "OWNER");
    await addOrgMember(manager.id, org.id, "MANAGER");
    const res = await resolveRecipients({ orgRoles: { orgId: org.id, roles: ["OWNER"] } }, {});
    expect(ids(res)).toEqual([owner.id]);
  });

  it("exclut l'auteur, les comptes bloqués et archivés, et excludeUserIds", async () => {
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

  it("eventRoles sur un évènement inexistant renvoie []", async () => {
    expect(await resolveRecipients({ eventRoles: { eventId: "inconnu", roles: ["ADMIN"] } }, {})).toEqual([]);
  });
});
