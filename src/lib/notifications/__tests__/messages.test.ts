import { describe, it, expect } from "vitest";
import {
  ROLE_LABELS,
  registrationCreatedMessage,
  registrationResubmittedMessage,
  registrationApprovedMessage,
  registrationRejectedMessage,
  badgePrintedMessage,
  profileSubmittedMessage,
  profileApprovedMessage,
  profileRejectedMessage,
  orgMembershipAddedMessage,
  eventMembershipAddedMessage,
  membershipRoleChangedMessage,
  eventRegistrationToggledMessage,
  orgCreatedMessage,
  subscriptionChangedMessage,
  subscriptionExpiringMessage,
  quotaExceededMessage,
  emailFailedMessage,
  printRequestSubmittedMessage,
  printRequestQuotedMessage,
  printRequestMessageMessage,
  printRequestStatusChangedMessage,
  printRequestPaidMessage,
  printPaymentUnmatchedMessage,
} from "../messages";
import type { NotificationContent } from "../types";
import { formatFcfa } from "@/lib/print-requests/labels";

describe("messages", () => {
  it("registrationCreated", () => {
    const m = registrationCreatedMessage({
      eventId: "e1", eventTitle: "Forum", registrationId: "r1", participantName: "Awa Diallo", categoryName: "Presse",
    });
    expect(m.title).toBe("Nouvelle inscription");
    expect(m.body).toContain("Awa Diallo");
    expect(m.body).toContain("Forum");
    expect(m.body).toContain("Presse");
    expect(m.href).toBe("/event/e1/registrations/r1");
    expect(m.primaryLabel).toBe("Voir l'inscription");
    expect(m.links).toEqual([{ label: "Voir l'évènement", href: "/event/e1" }]);
  });

  it("registrationResubmitted", () => {
    const m = registrationResubmittedMessage({
      eventId: "e1", eventTitle: "Forum", registrationId: "r1", participantName: "Awa Diallo",
    });
    expect(m.title).toBe("Inscription resoumise");
    expect(m.href).toBe("/event/e1/registrations/r1");
    expect(m.primaryLabel).toBe("Voir l'inscription");
    expect(m.links).toEqual([{ label: "Voir l'évènement", href: "/event/e1" }]);
    expect(m.body).toContain("Awa Diallo");
  });

  it("le corps de resoumission mentionne le changement de catégorie", () => {
    const base = { eventId: "e1", eventTitle: "Forum", registrationId: "r1", participantName: "Awa" };
    const changed = registrationResubmittedMessage({ ...base, categoryChanged: { from: "Presse", to: "Exposant" } });
    expect(changed.body).toContain("Exposant");
    expect(changed.body).toContain("Presse");
    expect(registrationResubmittedMessage(base).body).not.toContain("catégorie");
  });

  it("registrationApproved", () => {
    const m = registrationApprovedMessage({ eventTitle: "Forum", registrationId: "r1" });
    expect(m.title).toBe("Inscription approuvée");
    expect(m.body).toContain("Forum");
    expect(m.href).toBe("/account/registrations/r1");
    expect(m.primaryLabel).toBe("Voir mon inscription");
    expect(m.links).toEqual([]);
  });

  it("registrationRejected", () => {
    const m = registrationRejectedMessage({ eventTitle: "Forum", registrationId: "r1", reason: "Photo floue" });
    expect(m.title).toBe("Inscription rejetée");
    expect(m.body).toContain("Motif : Photo floue");
    expect(m.href).toBe("/account/registrations/r1");
    expect(m.primaryLabel).toBe("Voir mon inscription");
  });

  it("le rejet sans motif n'affiche pas « Motif : »", () => {
    expect(registrationRejectedMessage({ eventTitle: "Forum", registrationId: "r1", reason: null }).body).not.toContain("Motif :");
  });

  it("badgePrinted", () => {
    const m = badgePrintedMessage({ eventTitle: "Forum", registrationId: "r1" });
    expect(m.title).toBe("Badge imprimé");
    expect(m.body).toContain("Forum");
    expect(m.href).toBe("/account/registrations/r1");
    expect(m.primaryLabel).toBe("Voir mon inscription");
  });

  it("profileSubmitted", () => {
    const m = profileSubmittedMessage({ userId: "u1", userName: "Awa Diallo" });
    expect(m.title).toBe("Profil à valider");
    expect(m.body).toContain("Awa Diallo");
    expect(m.href).toBe("/platform/profiles/u1");
    expect(m.primaryLabel).toBe("Voir le profil");
  });

  it("profileApproved et profileRejected", () => {
    const a = profileApprovedMessage();
    expect(a.title).toBe("Profil validé");
    expect(a.href).toBe("/account/profile");
    expect(a.primaryLabel).toBe("Voir mon profil");
    const r = profileRejectedMessage({ reason: "Document illisible" });
    expect(r.title).toBe("Documents refusés");
    expect(r.body).toContain("Motif : Document illisible");
    expect(r.href).toBe("/account/profile");
    expect(profileRejectedMessage({ reason: null }).body).not.toContain("Motif :");
  });

  it("orgMembershipAdded", () => {
    const m = orgMembershipAddedMessage({ orgId: "o1", orgName: "Acme", role: "OWNER" });
    expect(m.title).toBe("Ajout à une organisation");
    expect(m.body).toContain("Acme");
    expect(m.body).toContain("Propriétaire");
    expect(m.href).toBe("/org/o1");
    expect(m.primaryLabel).toBe("Ouvrir l'organisation");
  });

  it("eventMembershipAdded", () => {
    const m = eventMembershipAddedMessage({ eventId: "e1", eventTitle: "Forum", role: "OPERATOR" });
    expect(m.title).toBe("Ajout à un évènement");
    expect(m.body).toContain("Forum");
    expect(m.body).toContain("Opérateur");
    expect(m.href).toBe("/event/e1");
    expect(m.primaryLabel).toBe("Ouvrir l'évènement");
  });

  it("membershipRoleChanged (org et évènement)", () => {
    const org = membershipRoleChangedMessage({ target: { kind: "org", orgId: "o1", name: "Acme" }, from: "AUDITOR", to: "MANAGER" });
    expect(org.title).toBe("Rôle modifié");
    expect(org.body).toContain("Auditeur");
    expect(org.body).toContain("Gérant");
    expect(org.body).toContain("Acme");
    expect(org.href).toBe("/org/o1");
    expect(org.primaryLabel).toBe("Ouvrir l'organisation");
    const ev = membershipRoleChangedMessage({ target: { kind: "event", eventId: "e1", name: "Forum" }, from: "VIEWER", to: "ADMIN" });
    expect(ev.href).toBe("/event/e1");
    expect(ev.primaryLabel).toBe("Ouvrir l'évènement");
    expect(ev.body).toContain("Lecteur");
    expect(ev.body).toContain("Administrateur");
  });

  it("eventRegistrationToggled", () => {
    const open = eventRegistrationToggledMessage({ eventId: "e1", eventTitle: "Forum", eventSlug: "forum", open: true });
    expect(open.title).toBe("Inscriptions ouvertes");
    expect(open.body).toContain("Forum");
    expect(open.href).toBe("/event/e1");
    expect(open.primaryLabel).toBe("Ouvrir l'évènement");
    expect(open.links).toEqual([{ label: "Page publique", href: "/e/forum" }]);
    const closed = eventRegistrationToggledMessage({ eventId: "e1", eventTitle: "Forum", eventSlug: "forum", open: false });
    expect(closed.title).toBe("Inscriptions fermées");
  });

  it("orgCreated", () => {
    const m = orgCreatedMessage({ orgId: "o1", orgName: "Acme" });
    expect(m.title).toBe("Nouvelle organisation");
    expect(m.body).toContain("Acme");
    expect(m.href).toBe("/platform/organizations/o1");
    expect(m.primaryLabel).toBe("Voir l'organisation");
  });

  it("subscriptionChanged (org et plateforme)", () => {
    const org = subscriptionChangedMessage({ orgId: "o1", orgName: "Acme", planName: "Pro", status: "ACTIVE", audience: "org" });
    expect(org.title).toBe("Abonnement modifié");
    expect(org.body).toContain("Pro");
    expect(org.body).toContain("Acme");
    expect(org.href).toBe("/org/o1/subscription");
    expect(org.primaryLabel).toBe("Voir l'abonnement");
    const pf = subscriptionChangedMessage({ orgId: "o1", orgName: "Acme", planName: "Pro", status: "EXPIRED", audience: "platform" });
    expect(pf.href).toBe("/platform/organizations/o1/subscription");
    expect(pf.body).toContain("expiré");
    expect(subscriptionChangedMessage({ orgId: "o1", orgName: "A", planName: "P", status: "CANCELLED", audience: "org" }).body).toContain("annulé");
    expect(org.body).toContain("actif");
  });

  it("subscriptionExpiring J-7 et J-1", () => {
    const endDate = new Date("2026-11-04T12:00:00.000Z");
    const j7 = subscriptionExpiringMessage({ orgId: "o1", orgName: "Acme", planName: "Pro", daysBefore: 7, endDate });
    expect(j7.title).toBe("Votre abonnement Pro expire dans 7 jours");
    expect(j7.body).toContain("l'abonnement expire");
    expect(j7.body).toContain("onglet Abonnement");
    expect(j7.body).not.toContain("gratuit");
    expect(j7.body).toContain("04/11/2026");
    expect(j7.href).toBe("/org/o1/subscription");
    expect(j7.primaryLabel).toBe("Renouveler");
    const j1 = subscriptionExpiringMessage({ orgId: "o1", orgName: "Acme", planName: "Pro", daysBefore: 1, endDate });
    expect(j1.title).toBe("Votre abonnement Pro expire demain");
  });

  it("quotaExceeded (org et plateforme)", () => {
    const org = quotaExceededMessage({ orgId: "o1", orgName: "Acme", eventId: "e1", audience: "org" });
    expect(org.title).toBe("Quota dépassé");
    expect(org.href).toBe("/org/o1/subscription");
    expect(org.primaryLabel).toBe("Voir l'abonnement");
    expect(org.links).toEqual([{ label: "Voir l'évènement", href: "/event/e1" }]);
    const pf = quotaExceededMessage({ orgId: "o1", orgName: "Acme", eventId: "e1", audience: "platform" });
    expect(pf.href).toBe("/platform/organizations/o1/subscription");
    expect(pf.links).toEqual([{ label: "Voir l'évènement", href: "/platform/organizations/o1/events" }]);
  });

  it("emailFailed", () => {
    const m = emailFailedMessage({ jobId: "j1", kind: "registration.approved", recipient: "a@b.c", attempts: 5 });
    expect(m.title).toBe("Email en échec");
    expect(m.body).toContain("registration.approved");
    expect(m.body).toContain("a@b.c");
    expect(m.body).toContain("5");
    expect(m.href).toBe("/platform/jobs/j1");
    expect(m.primaryLabel).toBe("Voir l'envoi");
    expect(emailFailedMessage({ jobId: "j1", kind: "k", recipient: null, attempts: 1 }).body).not.toContain("null");
  });

  it("encode les identifiants dans les liens", () => {
    expect(registrationApprovedMessage({ eventTitle: "F", registrationId: "a/b" }).href.endsWith("a%2Fb")).toBe(true);
  });

  it("libellés de rôles accentués", () => {
    expect(ROLE_LABELS).toMatchObject({
      OWNER: "Propriétaire", MANAGER: "Gérant", AUDITOR: "Auditeur",
      ADMIN: "Administrateur", OPERATOR: "Opérateur", PRINTER: "Impression", VIEWER: "Lecteur",
    });
  });

  it("tous les liens sont relatifs à l'application", () => {
    const all: NotificationContent[] = [
      registrationCreatedMessage({ eventId: "e", eventTitle: "t", registrationId: "r", participantName: "n", categoryName: "c" }),
      registrationResubmittedMessage({ eventId: "e", eventTitle: "t", registrationId: "r", participantName: "n" }),
      registrationApprovedMessage({ eventTitle: "t", registrationId: "r" }),
      registrationRejectedMessage({ eventTitle: "t", registrationId: "r", reason: null }),
      badgePrintedMessage({ eventTitle: "t", registrationId: "r" }),
      profileSubmittedMessage({ userId: "u", userName: "n" }),
      profileApprovedMessage(),
      profileRejectedMessage({ reason: null }),
      orgMembershipAddedMessage({ orgId: "o", orgName: "n", role: "OWNER" }),
      eventMembershipAddedMessage({ eventId: "e", eventTitle: "t", role: "ADMIN" }),
      membershipRoleChangedMessage({ target: { kind: "org", orgId: "o", name: "n" }, from: "OWNER", to: "MANAGER" }),
      eventRegistrationToggledMessage({ eventId: "e", eventTitle: "t", eventSlug: "s", open: true }),
      orgCreatedMessage({ orgId: "o", orgName: "n" }),
      subscriptionChangedMessage({ orgId: "o", orgName: "n", planName: "p", status: "ACTIVE", audience: "org" }),
      subscriptionExpiringMessage({ orgId: "o", orgName: "n", planName: "p", daysBefore: 7, endDate: new Date() }),
      quotaExceededMessage({ orgId: "o", orgName: "n", eventId: "e", audience: "platform" }),
      emailFailedMessage({ jobId: "j", kind: "k", recipient: null, attempts: 1 }),
      printRequestSubmittedMessage({ requestId: "p", reference: "IMP-1", eventTitle: "t", orgName: "o", type: "ADVANCE", badgeCount: 1 }),
      printRequestQuotedMessage({ requestId: "p", eventId: "e", reference: "IMP-1", eventTitle: "t", version: 1, total: 1 }),
      printRequestMessageMessage({ requestId: "p", eventId: "e", reference: "IMP-1", authorName: "n", body: "b", toStaff: true }),
      printRequestStatusChangedMessage({ requestId: "p", eventId: "e", reference: "IMP-1", eventTitle: "t", status: "PAID", toStaff: false }),
    ];
    for (const m of all) {
      expect(m.href).toMatch(/^\/(?!\/)/);
      for (const l of m.links) expect(l.href).toMatch(/^\/(?!\/)/);
    }
  });

  describe("commandes d'impression", () => {
    it("printRequestSubmitted", () => {
      const m = printRequestSubmittedMessage({
        requestId: "p1", reference: "IMP-2026-0001", eventTitle: "Forum", orgName: "Acme", type: "ONSITE", badgeCount: 12,
      });
      expect(m.title).toBe("Nouvelle commande d'impression");
      expect(m.body).toBe("Acme a envoyé la commande IMP-2026-0001 (pendant l'évènement, 12 badges) pour Forum.");
      expect(m.href).toBe("/platform/print/orders/p1");
      expect(m.primaryLabel).toBe("Voir la commande");
      expect(m.links).toEqual([]);
    });

    it("printRequestQuoted", () => {
      const m = printRequestQuotedMessage({
        requestId: "p1", eventId: "e1", reference: "IMP-2026-0001", eventTitle: "Forum", version: 2, total: 150000,
      });
      expect(m.title).toBe("Devis d'impression disponible");
      expect(m.body).toBe(
        `Le devis v2 de la commande IMP-2026-0001 (Forum) s'élève à ${formatFcfa(150000)}. Le propriétaire de l'organisation peut l'accepter.`,
      );
      expect(m.href).toBe("/event/e1/print/p1");
      expect(m.primaryLabel).toBe("Voir le devis");
      expect(m.links).toEqual([]);
    });

    it("printRequestMessage : lien selon le destinataire, extrait tronqué à 140", () => {
      const base = { requestId: "p1", eventId: "e1", reference: "IMP-2026-0001", authorName: "Awa" };
      const long = printRequestMessageMessage({ ...base, body: "x".repeat(200), toStaff: true });
      expect(long.title).toBe("Nouveau message — IMP-2026-0001");
      expect(long.body).toBe(`Awa : ${"x".repeat(140)}…`);
      expect(long.href).toBe("/platform/print/orders/p1");
      expect(long.primaryLabel).toBe("Répondre");
      expect(long.links).toEqual([]);
      const exact = printRequestMessageMessage({ ...base, body: "y".repeat(140), toStaff: false });
      expect(exact.body).toBe(`Awa : ${"y".repeat(140)}`);
      expect(exact.href).toBe("/event/e1/print/p1");
    });

    it("printRequestPaid : titre, corps et lien selon l'audience", () => {
      const base = { requestId: "p1", eventId: "e1", reference: "IMP-2026-0042", eventTitle: "Forum", amount: 150000 };
      const m = printRequestPaidMessage({ ...base, manual: false, audience: "event" });
      expect(m.title).toBe("Commande IMP-2026-0042 payée");
      expect(m.body).toBe(`Le paiement de ${formatFcfa(150000)} de la commande IMP-2026-0042 (Forum) est reçu.`);
      expect(m.body).toContain("150");
      expect(m.href).toBe("/event/e1/print/p1");
      expect(m.primaryLabel).toBe("Voir la commande");
      expect(m.links).toEqual([]);
      expect(printRequestPaidMessage({ ...base, manual: false, audience: "platform" }).href).toBe("/platform/print/orders/p1");
    });

    it("printRequestPaid manual : marquée payée par l'équipe Badge", () => {
      const m = printRequestPaidMessage({
        requestId: "p1", eventId: "e1", reference: "IMP-2026-0042", eventTitle: "Forum", amount: 1, manual: true, audience: "platform",
      });
      expect(m.body).toBe("La commande IMP-2026-0042 (Forum) a été marquée payée par l'équipe Badge.");
    });

    it("printPaymentUnmatched : titre, corps, lien plateforme", () => {
      const m = printPaymentUnmatchedMessage({ requestId: "p1", reference: "IMP-2026-0042", amount: 150000 });
      expect(m.title).toBe("Paiement à vérifier : IMP-2026-0042");
      expect(m.body).toBe(`Un paiement de ${formatFcfa(150000)} a été approuvé alors que la commande n'attendait plus ce paiement.`);
      expect(m.href).toBe("/platform/print/orders/p1");
      expect(m.primaryLabel).toBe("Voir la commande");
    });

    it("printRequestStatusChanged : lien selon le destinataire", () => {
      const base = { requestId: "p1", eventId: "e1", reference: "IMP-2026-0001", eventTitle: "Forum", status: "IN_PRODUCTION" as const };
      const org = printRequestStatusChangedMessage({ ...base, toStaff: false });
      expect(org.title).toBe("Commande IMP-2026-0001 : en production");
      expect(org.body).toBe("La commande d'impression IMP-2026-0001 (Forum) est maintenant « En production ».");
      expect(org.href).toBe("/event/e1/print/p1");
      expect(org.primaryLabel).toBe("Voir la commande");
      expect(org.links).toEqual([]);
      expect(printRequestStatusChangedMessage({ ...base, toStaff: true }).href).toBe("/platform/print/orders/p1");
    });
  });
});
