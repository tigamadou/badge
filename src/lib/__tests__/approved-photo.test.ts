import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";

type Status = "PENDING" | "APPROVED" | "REJECTED";

async function createUser(email: string) {
  return prisma.user.create({ data: { email, password: "x", name: "U" } });
}

function submit(userId: string, status: Status, photo: string, createdAt: Date) {
  return prisma.profileSubmission.create({
    data: {
      userId,
      status,
      photo,
      idDocumentType: "CNI",
      idDocumentNumber: "AB1234",
      idDocument: "profile/u1/documents/d.pdf",
      createdAt,
    },
  });
}

const JAN = new Date("2026-01-01T10:00:00Z");
const FEB = new Date("2026-02-01T10:00:00Z");

describe("getApprovedPhotoUrl", () => {
  it("returns null when the user has no submission", async () => {
    const user = await createUser("none@ap.test");
    expect(await getApprovedPhotoUrl(user.id)).toBeNull();
  });

  it("returns null when the only submission is pending or rejected", async () => {
    const user = await createUser("nonapproved@ap.test");
    await submit(user.id, "PENDING", "profile/u1/photos/a.png", JAN);
    await submit(user.id, "REJECTED", "profile/u1/photos/b.png", FEB);
    expect(await getApprovedPhotoUrl(user.id)).toBeNull();
  });

  it("returns the photo URL of the approved submission", async () => {
    const user = await createUser("approved@ap.test");
    await submit(user.id, "APPROVED", "profile/u1/photos/a.png", JAN);
    expect(await getApprovedPhotoUrl(user.id)).toBe("/api/files/profile/u1/photos/a.png");
  });

  it("returns the most recent approved submission", async () => {
    const user = await createUser("recent@ap.test");
    await submit(user.id, "APPROVED", "profile/u1/photos/a.png", JAN);
    await submit(user.id, "APPROVED", "profile/u1/photos/b.png", FEB);
    expect(await getApprovedPhotoUrl(user.id)).toBe("/api/files/profile/u1/photos/b.png");
  });

  it("keeps the previous approved photo when a newer submission is pending", async () => {
    const user = await createUser("pending@ap.test");
    await submit(user.id, "APPROVED", "profile/u1/photos/a.png", JAN);
    await submit(user.id, "PENDING", "profile/u1/photos/b.png", FEB);
    expect(await getApprovedPhotoUrl(user.id)).toBe("/api/files/profile/u1/photos/a.png");
  });

  it("keeps the previous approved photo when a newer submission is rejected", async () => {
    const user = await createUser("rejected@ap.test");
    await submit(user.id, "APPROVED", "profile/u1/photos/a.png", JAN);
    await submit(user.id, "REJECTED", "profile/u1/photos/b.png", FEB);
    expect(await getApprovedPhotoUrl(user.id)).toBe("/api/files/profile/u1/photos/a.png");
  });

  it("ignores other users' approved submissions", async () => {
    const user = await createUser("self@ap.test");
    const other = await createUser("other@ap.test");
    await submit(other.id, "APPROVED", "profile/o1/photos/a.png", JAN);
    expect(await getApprovedPhotoUrl(user.id)).toBeNull();
  });
});
