// Helper de test partage (render-badge, route du lot) : plateforme, organisation,
// evenement, deux categories (dont une anonyme) et un utilisateur connecte.
// Le fichier de test appelant doit declarer vi.mock("next-auth", ...).
import { vi } from "vitest";
import { getServerSession } from "next-auth";
import type { EventRole, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, familyTemplateId } from "../install";

let seq = 0;

export async function createBadgeFixtures(opts: { role?: EventRole; orgOwner?: boolean } = {}) {
  const { role = "ADMIN", orgOwner = true } = opts;
  await ensureReferenceTemplates("seed-test");
  const defaultId = (await defaultTemplateId())!;
  const rectoVersoId = (await familyTemplateId("recto-verso"))!;
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { badgeTemplateId: defaultId },
    create: {
      id: "singleton",
      smtpHost: "mailpit",
      smtpPort: 1025,
      smtpFrom: "noreply@badge.local",
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      badgeTemplateId: defaultId,
    },
  });

  const stamp = `${Date.now()}-${++seq}`;
  const admin = await prisma.user.create({
    data: {
      email: `bdg-${stamp}@render.test`,
      password: "x",
      name: "Bdg Admin",
      isStaff: false,
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({ data: { name: "Bdg Org", slug: `bdg-org-${stamp}` } });
  if (orgOwner) {
    await prisma.orgMembership.create({ data: { userId: admin.id, orgId: org.id, role: "OWNER" } });
  }
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Salon Bdg",
      slug: `salon-bdg-${stamp}`,
      location: "Abidjan",
      date: new Date("2026-10-01"),
    },
  });
  await prisma.eventMembership.create({ data: { userId: admin.id, eventId: event.id, role } });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Visiteur", color: "#4f46e5", number: 1 },
  });
  const anonymousCategory = await prisma.category.create({
    data: { eventId: event.id, name: "Securite", color: "#334155", number: 2, anonymous: true },
  });

  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: admin.id, email: admin.email, name: admin.name, isStaff: false },
  } as never);

  let n = 0;
  async function addRegistration(
    o: { firstName?: string; lastName?: string; anonymous?: boolean; status?: RegistrationStatus } = {},
  ) {
    n += 1;
    // Une inscription par utilisateur et par evenement (@@unique([userId, eventId])).
    const participant = await prisma.user.create({
      data: {
        email: `bdg-${stamp}-p${n}@render.test`,
        password: "x",
        name: `Participant ${n}`,
        isStaff: false,
        emailVerifiedAt: new Date(),
      },
    });
    return prisma.registration.create({
      data: {
        id: `BADGE-${stamp}-${n}`,
        eventId: event.id,
        categoryId: o.anonymous ? anonymousCategory.id : category.id,
        userId: participant.id,
        snapshotFirstName: o.firstName ?? "Awa",
        snapshotLastName: o.lastName ?? "Diallo",
        snapshotEmail: participant.email,
        snapshotStructure: "ENSEA",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: `X-${n}`,
        snapshotIdDocument: "uploads/test/cni.pdf",
        status: o.status ?? "APPROVED",
      },
    });
  }

  return { admin, org, event, category, anonymousCategory, defaultId, rectoVersoId, addRegistration };
}
