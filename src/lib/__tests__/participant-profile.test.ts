import { describe, it, expect } from "vitest";
import {
  isParticipantProfileComplete,
  buildRegistrationSnapshot,
  computeParticipantProfileCompletedAt,
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
