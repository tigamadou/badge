import { beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { overrideExporter } from "@/lib/renderer";
import { fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";

// Reset global DB avant chaque test. L'ordre suit les contraintes FK :
// tout ce qui depend de Event/Organization/User est efface en premier,
// puis Event, Organization, User en dernier.
//
// Cet hook tourne AVANT le beforeEach de chaque fichier de tests (qui peut
// rester en place pour delete des entites supplementaires ou reset des mocks).
beforeEach(async () => {
  fakeExporter.reset();
  overrideExporter(fakeExporter);
  await prisma.payment.deleteMany();
  await prisma.printRequestMessage.deleteMany();
  await prisma.printQuoteLine.deleteMany();
  await prisma.printRequestItem.deleteMany();
  // FK auto-referente : detacher les demandes enfants avant la suppression.
  await prisma.printRequest.updateMany({ data: { parentRequestId: null } });
  await prisma.printSheetGeneration.deleteMany();
  await prisma.printRequest.deleteMany();
  await prisma.printSheetLayout.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.job.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.subscriptionReminder.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.profileSubmission.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.rejectionReason.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.categoryTemplate.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.printProduct.deleteMany();
  await prisma.user.deleteMany();
});
