import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { AuthError, requireRegistrationOwner } from "@/lib/auth-participant";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

function mockSession(user: { id: string; email?: string; name?: string } | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    user ? ({ user } as never) : (null as never),
  );
}

async function createRegistration(ownerId: string) {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${ownerId}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${ownerId}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "C", color: "#000000", number: 1 },
  });
  return prisma.registration.create({
    data: {
      id: `reg-${ownerId}`,
      eventId: event.id,
      categoryId: cat.id,
      userId: ownerId,
      status: "PENDING",
      snapshotFirstName: "F",
      snapshotLastName: "L",
      snapshotEmail: "s@x",
      snapshotStructure: "S",
      snapshotPhoto: "",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "123",
      snapshotIdDocument: "",
    },
  });
}

describe("requireRegistrationOwner", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("throws NOT_AUTHENTICATED (401) when there is no session", async () => {
    mockSession(null);
    await expect(requireRegistrationOwner("reg-x")).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
      httpStatus: 401,
    });
  });

  it("throws FORBIDDEN (403) when the registration does not exist", async () => {
    const user = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: user.id, email: user.email, name: user.name });

    await expect(requireRegistrationOwner("does-not-exist")).rejects.toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
    });
  });

  it("throws FORBIDDEN (403) when the registration belongs to another user", async () => {
    const owner = await prisma.user.create({ data: { email: "owner@x", password: "x", name: "O" } });
    const other = await prisma.user.create({ data: { email: "other@x", password: "x", name: "X" } });
    const reg = await createRegistration(owner.id);
    mockSession({ id: other.id, email: other.email, name: other.name });

    await expect(requireRegistrationOwner(reg.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
    });
  });

  it("returns the user and registration when the caller owns it", async () => {
    const owner = await prisma.user.create({ data: { email: "owner2@x", password: "x", name: "O" } });
    const reg = await createRegistration(owner.id);
    mockSession({ id: owner.id, email: owner.email, name: owner.name });

    const result = await requireRegistrationOwner(reg.id);
    expect(result.user.id).toBe(owner.id);
    expect(result.registration).toEqual({ id: reg.id, userId: owner.id, status: "PENDING" });
  });

  it("email/name vides si absents de la session (fallback ?? \"\")", async () => {
    const owner = await prisma.user.create({ data: { email: "owner3@x", password: "x", name: "O" } });
    const reg = await createRegistration(owner.id);
    mockSession({ id: owner.id }); // session sans email ni name
    const result = await requireRegistrationOwner(reg.id);
    expect(result.user).toMatchObject({ id: owner.id, email: "", name: "" });
  });

  it("uses AuthError for the thrown errors", async () => {
    mockSession(null);
    await expect(requireRegistrationOwner("reg-x")).rejects.toBeInstanceOf(AuthError);
  });
});
