import { beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Reset global DB avant chaque test. L'ordre suit les contraintes FK :
// tout ce qui depend de Event/Organization/User est efface en premier,
// puis Event, Organization, User en dernier.
//
// Cet hook tourne AVANT le beforeEach de chaque fichier de tests (qui peut
// rester en place pour delete des entites supplementaires ou reset des mocks).
beforeEach(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.categoryTemplate.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});
