import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { AuthError, requireRegistrationOwner, requireParticipantPermission } from "@/lib/auth-participant";

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

describe("requireParticipantPermission", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("401 NOT_AUTHENTICATED sans session", async () => {
    mockSession(null);
    await expect(requireParticipantPermission("registration.self.create")).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
      httpStatus: 401,
    });
  });

  it("401 pour un compte archivé", async () => {
    const u = await prisma.user.create({ data: { email: "pa@x", password: "x", name: "A", archived: true } });
    mockSession({ id: u.id, email: u.email, name: u.name });
    await expect(requireParticipantPermission("registration.self.create")).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
      httpStatus: 401,
    });
  });

  it("403 ACCOUNT_BLOCKED pour un compte bloqué", async () => {
    const u = await prisma.user.create({ data: { email: "pb@x", password: "x", name: "B", blocked: true } });
    mockSession({ id: u.id, email: u.email, name: u.name });
    await expect(requireParticipantPermission("registration.self.create")).rejects.toMatchObject({
      code: "ACCOUNT_BLOCKED",
      httpStatus: 403,
    });
  });

  it("403 FORBIDDEN quand un REVOKE plateforme retire la permission", async () => {
    const u = await prisma.user.create({ data: { email: "pr@x", password: "x", name: "R" } });
    await prisma.userPermissionOverride.create({
      data: { userId: u.id, orgId: null, permission: "registration.self.create", effect: "REVOKE" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name });
    await expect(requireParticipantPermission("registration.self.create")).rejects.toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
    });
  });

  it("retourne le SessionUser pour un compte normal", async () => {
    const u = await prisma.user.create({ data: { email: "pn@x", password: "x", name: "N" } });
    mockSession({ id: u.id, email: u.email, name: u.name });
    await expect(requireParticipantPermission("registration.self.create")).resolves.toEqual({
      id: u.id,
      email: u.email,
      name: u.name,
    });
  });
});
