import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { refreshPendingRegistrationSnapshots } from "@/lib/registration-snapshot-sync";

let counter = 0;

// Profil complet : buildRegistrationSnapshot() exige les sept champs.
async function makeParticipant(scope: string) {
  return prisma.user.create({
    data: {
      email: `p-${scope}@sync.test`,
      password: "x",
      name: "P",
      firstName: "Ancien",
      lastName: "Nom",
      structure: "Ancienne structure",
      photo: "profile/u/photos/old.jpg",
      idDocumentType: "CNI",
      idDocumentNumber: "OLD-1",
      idDocument: "profile/u/documents/old.pdf",
      profileStatus: "APPROVED",
    },
  });
}

async function makeEvent(scope: string, opts?: { archived?: boolean }) {
  const org = await prisma.organization.create({
    data: { name: `Org ${scope}`, slug: `org-${scope}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Event",
      slug: `event-${scope}`,
      location: "L",
      date: new Date("2026-12-15"),
      archived: opts?.archived ?? false,
    },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Cat", color: "#123456", number: 1 },
  });
  return { orgId: org.id, eventId: event.id, categoryId: category.id };
}

async function makeRegistration(args: {
  userId: string;
  eventId: string;
  categoryId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}) {
  counter += 1;
  return prisma.registration.create({
    data: {
      id: `reg-sync-${counter}`,
      userId: args.userId,
      eventId: args.eventId,
      categoryId: args.categoryId,
      status: args.status ?? "PENDING",
      snapshotFirstName: "Ancien",
      snapshotLastName: "Nom",
      snapshotEmail: "fige@sync.test",
      snapshotStructure: "Ancienne structure",
      snapshotPhoto: "uploads/legacy/old.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "OLD-1",
      snapshotIdDocument: "profile/u/documents/old.pdf",
    },
  });
}

describe("refreshPendingRegistrationSnapshots", () => {
  it("realigne une inscription en attente sur le profil", async () => {
    const user = await makeParticipant("a");
    const { orgId, eventId, categoryId } = await makeEvent("a");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg", structure: "Nouvelle structure" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      {
        registrationId: reg.id,
        eventId,
        orgId,
        outcome: "refreshed",
        fields: expect.arrayContaining(["snapshotPhoto", "snapshotStructure"]),
      },
    ]);

    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("profile/u/photos/new.jpg");
    expect(after.snapshotStructure).toBe("Nouvelle structure");
  });

  it("ne touche pas une inscription approuvee ni une inscription rejetee", async () => {
    const user = await makeParticipant("b");
    const { eventId, categoryId } = await makeEvent("b");
    const approved = await makeRegistration({
      userId: user.id,
      eventId,
      categoryId,
      status: "APPROVED",
    });
    const other = await makeEvent("b2");
    const rejected = await makeRegistration({
      userId: user.id,
      eventId: other.eventId,
      categoryId: other.categoryId,
      status: "REJECTED",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const a = await prisma.registration.findUniqueOrThrow({ where: { id: approved.id } });
    const r = await prisma.registration.findUniqueOrThrow({ where: { id: rejected.id } });
    expect(a.snapshotPhoto).toBe("uploads/legacy/old.jpg");
    expect(r.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("ignore une inscription en attente sur un evenement archive", async () => {
    const user = await makeParticipant("c");
    const { eventId, categoryId } = await makeEvent("c", { archived: true });
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("n'ecrit rien quand le snapshot est deja aligne", async () => {
    const user = await makeParticipant("d");
    const { eventId, categoryId } = await makeEvent("d");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });

    await refreshPendingRegistrationSnapshots(user.id);
    const first = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const second = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("ne fait rien si le profil est incomplet", async () => {
    const user = await makeParticipant("e");
    const { eventId, categoryId } = await makeEvent("e");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    await prisma.user.update({ where: { id: user.id }, data: { photo: null } });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("uploads/legacy/old.jpg");
  });

  it("retourne un tableau vide pour un utilisateur inconnu", async () => {
    expect(await refreshPendingRegistrationSnapshots("inconnu")).toEqual([]);
  });

  it("saute l'inscription dont l'evenement bloque le nouveau numero, et met a jour les autres", async () => {
    const user = await makeParticipant("f");
    const bloquant = await makeEvent("f-bloquant");
    const libre = await makeEvent("f-libre");
    const regBloquee = await makeRegistration({
      userId: user.id,
      eventId: bloquant.eventId,
      categoryId: bloquant.categoryId,
    });
    const regLibre = await makeRegistration({
      userId: user.id,
      eventId: libre.eventId,
      categoryId: libre.categoryId,
    });
    await prisma.blockedDocument.create({
      data: { eventId: bloquant.eventId, documentNumber: "NEW-1", reason: "Fraude" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { idDocumentNumber: "NEW-1", photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toContainEqual({
      registrationId: regBloquee.id,
      eventId: bloquant.eventId,
      orgId: bloquant.orgId,
      outcome: "skipped_document_blocked",
    });
    expect(outcomes).toContainEqual(
      expect.objectContaining({ registrationId: regLibre.id, outcome: "refreshed" }),
    );

    const bloquee = await prisma.registration.findUniqueOrThrow({ where: { id: regBloquee.id } });
    const passee = await prisma.registration.findUniqueOrThrow({ where: { id: regLibre.id } });
    expect(bloquee.snapshotIdDocumentNumber).toBe("OLD-1");
    expect(bloquee.snapshotPhoto).toBe("uploads/legacy/old.jpg");
    expect(passee.snapshotIdDocumentNumber).toBe("NEW-1");
  });

  it("saute l'inscription quand le blocage est au niveau plateforme", async () => {
    const user = await makeParticipant("g");
    const { orgId, eventId, categoryId } = await makeEvent("g");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    await prisma.blockedDocument.create({
      data: { eventId: null, documentNumber: "NEW-2", reason: "Blocage plateforme" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { idDocumentNumber: "NEW-2" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      { registrationId: reg.id, eventId, orgId, outcome: "skipped_document_blocked" },
    ]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotIdDocumentNumber).toBe("OLD-1");
  });

  it("ne consulte pas les blocages quand le numero de piece n'a pas change", async () => {
    const user = await makeParticipant("h");
    const { eventId, categoryId } = await makeEvent("h");
    const reg = await makeRegistration({ userId: user.id, eventId, categoryId });
    // Un blocage existe sur le numero courant : il ne doit pas s'appliquer,
    // puisque la propagation ne change pas ce champ.
    await prisma.blockedDocument.create({
      data: { eventId, documentNumber: "OLD-1", reason: "Blocage historique" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: "profile/u/photos/new.jpg" },
    });

    const outcomes = await refreshPendingRegistrationSnapshots(user.id);

    expect(outcomes).toEqual([
      expect.objectContaining({ registrationId: reg.id, outcome: "refreshed" }),
    ]);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after.snapshotPhoto).toBe("profile/u/photos/new.jpg");
  });
});
