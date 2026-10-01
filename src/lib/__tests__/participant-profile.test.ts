import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  isParticipantProfileComplete,
  buildRegistrationSnapshot,
  computeParticipantProfileCompletedAt,
  recomputeParticipantProfileCompletedAt,
  type ParticipantProfileFields,
} from "@/lib/participant-profile";

const COMPLETE: ParticipantProfileFields = {
  firstName: "Alice",
  lastName: "Doe",
  email: "alice@x.test",
  structure: "Org",
  photo: "/uploads/photo.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "/uploads/doc.pdf",
};

describe("participant-profile", () => {
  describe("isParticipantProfileComplete", () => {
    it("returns true when every required field is a non-empty string", () => {
      expect(isParticipantProfileComplete(COMPLETE)).toBe(true);
    });

    it("returns false if one field is null", () => {
      expect(isParticipantProfileComplete({ ...COMPLETE, photo: null })).toBe(false);
    });

    it("returns false if one field is undefined", () => {
      expect(isParticipantProfileComplete({ ...COMPLETE, structure: undefined })).toBe(false);
    });

    it("returns false if one field is an empty string", () => {
      expect(isParticipantProfileComplete({ ...COMPLETE, idDocumentNumber: "" })).toBe(false);
    });

    it("ignores email for completeness check (email is not in REQUIRED_PROFILE_KEYS)", () => {
      // email is checked separately by buildRegistrationSnapshot
      expect(isParticipantProfileComplete({ ...COMPLETE, email: null })).toBe(true);
    });
  });

  describe("buildRegistrationSnapshot", () => {
    it("returns a complete snapshot object when profile is complete", () => {
      const snap = buildRegistrationSnapshot(COMPLETE);
      expect(snap).toEqual({
        snapshotFirstName: "Alice",
        snapshotLastName: "Doe",
        snapshotEmail: "alice@x.test",
        snapshotStructure: "Org",
        snapshotPhoto: "/uploads/photo.png",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "AB1234",
        snapshotIdDocument: "/uploads/doc.pdf",
      });
    });

    it("throws when profile is incomplete", () => {
      expect(() =>
        buildRegistrationSnapshot({ ...COMPLETE, firstName: null }),
      ).toThrow(/incomplet/);
    });

    it("throws when email is missing even if other fields complete", () => {
      expect(() => buildRegistrationSnapshot({ ...COMPLETE, email: null })).toThrow(
        /incomplet/,
      );
    });
  });

  describe("computeParticipantProfileCompletedAt", () => {
    it("returns a Date when profile is complete", () => {
      const result = computeParticipantProfileCompletedAt(COMPLETE);
      expect(result).toBeInstanceOf(Date);
    });

    it("returns null when profile is incomplete", () => {
      expect(computeParticipantProfileCompletedAt({ ...COMPLETE, photo: null })).toBeNull();
    });
  });
});

const COMPLETE_DB_FIELDS = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "Org",
  photo: "/uploads/photo.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "/uploads/doc.pdf",
};

let userCounter = 0;
async function createUser(data: Record<string, unknown>) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      email: `pp-${userCounter}@x.test`,
      password: "x",
      name: "U",
      ...data,
    },
  });
}

describe("recomputeParticipantProfileCompletedAt", () => {
  it("returns silently when the user does not exist", async () => {
    await expect(
      recomputeParticipantProfileCompletedAt("nonexistent-user"),
    ).resolves.toBeUndefined();
  });

  it("does nothing when profile is incomplete and completedAt already null", async () => {
    const user = await createUser({ firstName: null, participantProfileCompletedAt: null });
    await recomputeParticipantProfileCompletedAt(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.participantProfileCompletedAt).toBeNull();
  });

  it("sets completedAt when profile becomes complete (was null)", async () => {
    const user = await createUser({ ...COMPLETE_DB_FIELDS, participantProfileCompletedAt: null });
    await recomputeParticipantProfileCompletedAt(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.participantProfileCompletedAt).not.toBeNull();
  });

  it("keeps a recent completedAt unchanged (debounce < 1s)", async () => {
    const recent = new Date();
    const user = await createUser({
      ...COMPLETE_DB_FIELDS,
      participantProfileCompletedAt: recent,
    });
    await recomputeParticipantProfileCompletedAt(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.participantProfileCompletedAt?.getTime()).toBe(recent.getTime());
  });

  it("refreshes an old completedAt when profile is still complete", async () => {
    const old = new Date(Date.now() - 3600_000);
    const user = await createUser({
      ...COMPLETE_DB_FIELDS,
      participantProfileCompletedAt: old,
    });
    await recomputeParticipantProfileCompletedAt(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.participantProfileCompletedAt).not.toBeNull();
    expect(after.participantProfileCompletedAt!.getTime()).toBeGreaterThan(old.getTime());
  });

  it("clears completedAt when profile became incomplete (was set)", async () => {
    const user = await createUser({
      ...COMPLETE_DB_FIELDS,
      photo: null,
      participantProfileCompletedAt: new Date(),
    });
    await recomputeParticipantProfileCompletedAt(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.participantProfileCompletedAt).toBeNull();
  });
});
