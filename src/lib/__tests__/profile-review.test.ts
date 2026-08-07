import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  submitProfile,
  approveProfile,
  rejectProfile,
  getCurrentSubmission,
} from "@/lib/profile-review";

const COMPLETE = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "ACME",
  photo: "profile/u1/photos/p.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "profile/u1/documents/d.pdf",
};

async function createUser(email: string, profile: Partial<typeof COMPLETE> = COMPLETE) {
  return prisma.user.create({
    data: { email, password: "x", name: "U", ...profile },
  });
}

async function createReason(scope: "PROFILE" | "REGISTRATION" | "BOTH", label = "Photo illisible") {
  return prisma.rejectionReason.create({ data: { label, scope } });
}

describe("submitProfile", () => {
  it("cree une soumission PENDING et bascule le profil en PENDING", async () => {
    const user = await createUser("submit@pr.test");
    const submission = await submitProfile(user.id);
    expect(submission?.status).toBe("PENDING");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
  });

  it("renvoie null et laisse le profil INCOMPLETE si les pieces manquent", async () => {
    const user = await createUser("incomplete@pr.test", { firstName: "A", lastName: "B", structure: "S" });
    expect(await submitProfile(user.id)).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("INCOMPLETE");
  });

  it("ne cree pas de doublon si les pieces sont inchangees", async () => {
    const user = await createUser("nodup@pr.test");
    await submitProfile(user.id);
    await submitProfile(user.id);
    expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(1);
  });

  it("cree une nouvelle soumission apres un rejet", async () => {
    const user = await createUser("resubmit@pr.test");
    const staff = await createUser("staff-resubmit@pr.test");
    await submitProfile(user.id);
    await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: (await createReason("PROFILE")).id });
    await prisma.user.update({
      where: { id: user.id },
      data: { idDocument: "profile/u1/documents/d2.pdf" },
    });
    await submitProfile(user.id);
    expect(await prisma.profileSubmission.count({ where: { userId: user.id } })).toBe(2);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("PENDING");
  });

  it("renvoie null pour un utilisateur inexistant", async () => {
    expect(await submitProfile("missing-user")).toBeNull();
  });
});

describe("approveProfile", () => {
  it("approuve la soumission courante et bascule le profil en APPROVED", async () => {
    const user = await createUser("approve@pr.test");
    const staff = await createUser("staff-approve@pr.test");
    await submitProfile(user.id);
    const decided = await approveProfile({ userId: user.id, reviewerId: staff.id });
    expect(decided.status).toBe("APPROVED");
    expect(decided.reviewedById).toBe(staff.id);
    expect(decided.reviewedAt).not.toBeNull();
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("APPROVED");
  });

  it("refuse s'il n'y a pas de soumission en attente", async () => {
    const user = await createUser("nopending@pr.test");
    const staff = await createUser("staff-nopending@pr.test");
    await expect(approveProfile({ userId: user.id, reviewerId: staff.id })).rejects.toMatchObject({
      code: "NO_PENDING_SUBMISSION",
    });
  });
});

describe("rejectProfile", () => {
  it("rejette avec le motif catalogue et fige son libelle", async () => {
    const user = await createUser("reject@pr.test");
    const staff = await createUser("staff-reject@pr.test");
    const reason = await createReason("PROFILE", "Piece illisible");
    await submitProfile(user.id);
    const decided = await rejectProfile({
      userId: user.id,
      reviewerId: staff.id,
      reasonId: reason.id,
      details: "Le numero est masque.",
    });
    expect(decided.status).toBe("REJECTED");
    expect(decided.rejectionReasonLabel).toBe("Piece illisible");
    expect(decided.rejectionDetails).toBe("Le numero est masque.");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.profileStatus).toBe("REJECTED");
  });

  it("accepte un motif de portee BOTH", async () => {
    const user = await createUser("reject-both@pr.test");
    const staff = await createUser("staff-both@pr.test");
    const reason = await createReason("BOTH", "Document suspecte");
    await submitProfile(user.id);
    const decided = await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id });
    expect(decided.rejectionReasonLabel).toBe("Document suspecte");
  });

  it("refuse un motif de portee REGISTRATION", async () => {
    const user = await createUser("reject-scope@pr.test");
    const staff = await createUser("staff-scope@pr.test");
    const reason = await createReason("REGISTRATION", "Quota atteint");
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "REASON_WRONG_SCOPE" });
  });

  it("refuse un motif inconnu", async () => {
    const user = await createUser("reject-unknown@pr.test");
    const staff = await createUser("staff-unknown@pr.test");
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: "missing" }),
    ).rejects.toMatchObject({ code: "REASON_NOT_FOUND" });
  });

  it("refuse un motif archive", async () => {
    const user = await createUser("reject-archived@pr.test");
    const staff = await createUser("staff-archived@pr.test");
    const reason = await prisma.rejectionReason.create({
      data: { label: "Motif retire", scope: "PROFILE", archived: true, archivedAt: new Date() },
    });
    await submitProfile(user.id);
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "REASON_NOT_FOUND" });
  });

  it("refuse s'il n'y a pas de soumission en attente", async () => {
    const user = await createUser("reject-nopending@pr.test");
    const staff = await createUser("staff-reject-nopending@pr.test");
    const reason = await createReason("PROFILE");
    await expect(
      rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: reason.id }),
    ).rejects.toMatchObject({ code: "NO_PENDING_SUBMISSION" });
  });
});

describe("getCurrentSubmission", () => {
  it("renvoie la soumission la plus recente", async () => {
    const user = await createUser("current@pr.test");
    await submitProfile(user.id);
    const current = await getCurrentSubmission(user.id);
    expect(current?.userId).toBe(user.id);
  });

  it("renvoie null sans soumission", async () => {
    const user = await createUser("current-none@pr.test");
    expect(await getCurrentSubmission(user.id)).toBeNull();
  });

  it("preserve l'immuabilite des soumissions passees", async () => {
    const user = await createUser("immutable@pr.test");
    const staff = await createUser("staff-immutable@pr.test");
    const first = await submitProfile(user.id);
    await rejectProfile({ userId: user.id, reviewerId: staff.id, reasonId: (await createReason("PROFILE")).id });
    await prisma.user.update({ where: { id: user.id }, data: { photo: "profile/u1/photos/p2.png" } });
    await submitProfile(user.id);
    const reloaded = await prisma.profileSubmission.findUnique({ where: { id: first!.id } });
    expect(reloaded?.photo).toBe("profile/u1/photos/p.png");
    expect(reloaded?.status).toBe("REJECTED");
  });
});
