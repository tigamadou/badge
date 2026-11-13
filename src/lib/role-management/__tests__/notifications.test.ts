import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeEvent, makeOrg, makeStaff, makeUser, seedFactories } from "@/test/factories";
import { notifyRoleAssigned, notifyRoleChanged } from "..";

beforeEach(() => seedFactories(51));

const owner = { systemKey: "OWNER", name: "Propriétaire" };
const manager = { systemKey: "MANAGER", name: "Gestionnaire" };
const agent = { systemKey: "AGENT", name: "Agent" };
const custom = { systemKey: null, name: "Comptable" };
const bodies = async (userId: string) => (await prisma.notification.findMany({ where: { userId } })).map((n) => `${n.type}|${n.body}`);

async function setup() {
  const org = await makeOrg({ name: "Acme" });
  const event = await makeEvent(org.id, { title: "Salon" });
  const actor = await makeStaff("SUPER_ADMIN");
  const user = await makeUser();
  return { org, event, actor, user };
}

describe("notifyRoleAssigned", () => {
  it("rôle à clé d'enum : message historique (libellé du rôle) pour l'organisation et l'évènement", async () => {
    const { org, event, actor, user } = await setup();
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, orgId: org.id, role: manager, invitationSent: false });
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, eventId: event.id, role: { systemKey: "VIEWER", name: "Lecteur" }, invitationSent: false });
    const list = await bodies(user.id);
    expect(list).toContain("ORG_MEMBERSHIP_ADDED|Vous avez été ajouté(e) à l'organisation Acme avec le rôle Gérant.");
    expect(list).toContain("EVENT_MEMBERSHIP_ADDED|Vous avez été ajouté(e) à l'évènement Salon avec le rôle Lecteur.");
  });

  it("AGENT ou rôle personnalisé : même message avec le nom du rôle", async () => {
    const { org, event, actor, user } = await setup();
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, orgId: org.id, role: agent, invitationSent: true });
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, eventId: event.id, role: custom, invitationSent: true });
    expect((await bodies(user.id)).sort()).toEqual([
      "EVENT_MEMBERSHIP_ADDED|Vous avez été ajouté(e) à l'évènement Salon avec le rôle Comptable.",
      "ORG_MEMBERSHIP_ADDED|Vous avez été ajouté(e) à l'organisation Acme avec le rôle Agent.",
    ]);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: user.id, scope: "ORG" } });
    expect(n.href).toBe(`/org/${org.id}`);
  });

  it("cible supprimée : aucune notification", async () => {
    const { actor, user } = await setup();
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, orgId: "absente", role: custom, invitationSent: true });
    await notifyRoleAssigned({ userId: user.id, actorId: actor.id, eventId: "absent", role: custom, invitationSent: true });
    expect(await bodies(user.id)).toEqual([]);
  });
});

describe("notifyRoleChanged", () => {
  it("deux rôles à clé d'enum : message historique", async () => {
    const { org, event, actor, user } = await setup();
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, orgId: org.id, from: manager, to: owner });
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, eventId: event.id, from: { systemKey: "VIEWER", name: "Lecteur" }, to: { systemKey: "ADMIN", name: "Administrateur d'évènement" } });
    const list = await bodies(user.id);
    expect(list).toContain("MEMBERSHIP_ROLE_CHANGED|Votre rôle dans l'organisation Acme est passé de Gérant à Propriétaire.");
    expect(list).toContain("MEMBERSHIP_ROLE_CHANGED|Votre rôle dans l'évènement Salon est passé de Lecteur à Administrateur.");
  });

  it("un rôle sans enum : message avec les noms ; mêmes noms ou cible absente : rien", async () => {
    const { org, event, actor, user } = await setup();
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, orgId: org.id, from: manager, to: custom });
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, eventId: event.id, from: custom, to: agent });
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, orgId: org.id, from: custom, to: custom });
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, orgId: "absente", from: custom, to: agent });
    await notifyRoleChanged({ userId: user.id, actorId: actor.id, eventId: "absent", from: custom, to: agent });
    expect((await bodies(user.id)).sort()).toEqual([
      "MEMBERSHIP_ROLE_CHANGED|Votre rôle dans l'organisation Acme est passé de Gestionnaire à Comptable.",
      "MEMBERSHIP_ROLE_CHANGED|Votre rôle dans l'évènement Salon est passé de Comptable à Agent.",
    ]);
  });
});
