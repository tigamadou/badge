import {
  PrismaClient,
  StaffRole,
  OrgRole,
  RegistrationStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { generateId } from "../src/lib/generate-id";

const prisma = new PrismaClient();

// ============================================================
// Configuration
// ============================================================

const DEMO_PASSWORD = "123456";
const DEMO_DOMAIN = "@demo.local";

// Reproductible : meme seed donne le meme jeu de donnees.
let rngState = 42;
function rand(): number {
  rngState = (rngState * 9301 + 49297) % 233280;
  return rngState / 233280;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ============================================================
// Donnees statiques
// ============================================================

const ORGS: Array<{
  slug: string;
  name: string;
  legalName: string;
  city: string;
  taxId: string;
  archived?: boolean;
}> = [
  { slug: "acme", name: "Acme Corporation", legalName: "Acme SARL", city: "Abidjan", taxId: "CI-001-001" },
  { slug: "globex", name: "Globex Industries", legalName: "Globex SA", city: "Yamoussoukro", taxId: "CI-001-002" },
  { slug: "initech", name: "Initech", legalName: "Initech SARL", city: "Bouake", taxId: "CI-001-003" },
  { slug: "umbrella", name: "Umbrella Corp", legalName: "Umbrella SA", city: "Daloa", taxId: "CI-001-004" },
  { slug: "stark", name: "Stark Industries", legalName: "Stark Innov. SARL", city: "San-Pedro", taxId: "CI-001-005" },
  { slug: "wayne", name: "Wayne Enterprises", legalName: "Wayne SARL", city: "Korhogo", taxId: "CI-001-006" },
  { slug: "cyberdyne", name: "Cyberdyne Systems", legalName: "Cyberdyne SA", city: "Man", taxId: "CI-001-007" },
  { slug: "soylent", name: "Soylent Corp", legalName: "Soylent SARL", city: "Divo", taxId: "CI-001-008", archived: true },
  { slug: "massive", name: "Massive Dynamic", legalName: "Massive Dyn. SA", city: "Gagnoa", taxId: "CI-001-009" },
  { slug: "tyrell", name: "Tyrell Corp", legalName: "Tyrell SARL", city: "Anyama", taxId: "CI-001-010" },
];

const FIRST_NAMES = [
  "Awa", "Yao", "Kouadio", "Aminata", "Kouassi", "Fatou", "Boubacar", "Akissi",
  "Brigitte", "Adjoua", "Marius", "Sonia", "Lassina", "Aida", "Issouf", "Mariam",
  "Sekou", "Solange", "Drissa", "Habiba", "Adama", "Christelle", "Souleymane",
  "Estelle", "Ibrahim", "Nadine", "Mohamed", "Charlotte", "Karim", "Pauline",
];

const LAST_NAMES = [
  "Diallo", "Kone", "Diabate", "Toure", "Bamba", "Coulibaly", "N'Guessan",
  "Konan", "Adingra", "Ouattara", "Cisse", "Doumbia", "Yeo", "Soro", "Traore",
  "Kouame", "Bakayoko", "Sangare", "Camara", "Goure",
];

const STRUCTURES = [
  "Universite Felix Houphouet-Boigny",
  "INP-HB Yamoussoukro",
  "ENSEA Abidjan",
  "Universite Nangui Abrogoua",
  "ESATIC",
  "ESI",
  "CSI Pole Tech",
  "MIAGE Abidjan",
  "Universite Alassane Ouattara",
  "Direction Generale des Impots",
  "Ministere de l'Innovation",
  "Orange CI",
  "MTN CI",
  "Societe Generale CI",
];

const EVENT_TEMPLATES: Array<{ key: string; title: string; location: string }> = [
  { key: "salon-tech", title: "Salon de l'innovation tech", location: "Sofitel Abidjan" },
  { key: "conf-africa", title: "Conference Tech Africa", location: "Palais des Congres" },
  { key: "hackathon", title: "Hackathon Civic Data", location: "ESATIC Treichville" },
  { key: "forum-emploi", title: "Forum de l'emploi", location: "Stade Felix Houphouet-Boigny" },
  { key: "salon-livre", title: "Salon du livre", location: "Place de la Republique" },
  { key: "assises", title: "Assises de l'IA", location: "Hotel Ivoire" },
  { key: "rencontres-data", title: "Rencontres Data Science", location: "Universite FHB" },
  { key: "expo-cyber", title: "Expo cybersecurite", location: "Espace CRRAE" },
  { key: "summit", title: "Summit Fintech CI", location: "Radisson Blu Abidjan" },
  { key: "salon-femme", title: "Salon Femme & Tech", location: "Centre culturel francais" },
];

const CATEGORY_NAMES = [
  { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  { name: "VIP", color: "#f59e0b", neutralBadge: false, anonymous: false },
  { name: "Presse", color: "#10b981", neutralBadge: false, anonymous: false },
  { name: "Exposant", color: "#ef4444", neutralBadge: false, anonymous: false },
  { name: "Organisateur", color: "#8b5cf6", neutralBadge: true, anonymous: false },
  { name: "Anonyme", color: "#6b7280", neutralBadge: false, anonymous: true },
];

const TEMPLATE_NAMES = [
  { name: "Visiteur standard", color: "#4f46e5" },
  { name: "VIP", color: "#f59e0b" },
  { name: "Presse accreditee", color: "#10b981" },
  { name: "Exposant premium", color: "#ef4444" },
  { name: "Staff interne", color: "#8b5cf6" },
];

const REJECTION_REASONS = [
  { reason: "Document illisible", details: "La photo du document est trop floue, merci de soumettre une nouvelle version." },
  { reason: "Email invalide", details: "L'email fourni ne correspond pas a un compte verifie." },
  { reason: "Structure manquante", details: "Veuillez preciser votre structure d'origine." },
  { reason: "Photo non conforme", details: "La photo doit etre une photo d'identite recente." },
];

// ============================================================
// Helpers
// ============================================================

function fakeName(): { firstName: string; lastName: string; full: string } {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  return { firstName, lastName, full: `${firstName} ${lastName}` };
}

function fakeStructure(): string {
  return pick(STRUCTURES);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================
// Cleanup ciblee sur les marqueurs demo
// ============================================================

async function cleanup(): Promise<void> {
  console.log("Cleanup: suppression des donnees demo precedentes...");

  // Ordre : enfants -> parents. ActivityLog en premier (FK SetNull sur user
  // mais on ne veut pas garder de logs orphelins). Les Organisation cascade
  // events, categories, registrations, memberships, etc.

  // Supprime les ActivityLog associees aux orgs/events/users demo.
  // ActivityLog n'a pas de relation nommee dans le schema, on filtre par
  // collecte d'ids prealable.
  const demoOrgIds = (
    await prisma.organization.findMany({
      where: { slug: { startsWith: "demo-" } },
      select: { id: true },
    })
  ).map((o) => o.id);
  const demoEventIds = (
    await prisma.event.findMany({
      where: { slug: { startsWith: "demo-" } },
      select: { id: true },
    })
  ).map((e) => e.id);
  const demoUserIds = (
    await prisma.user.findMany({
      where: { email: { contains: DEMO_DOMAIN } },
      select: { id: true },
    })
  ).map((u) => u.id);

  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        demoUserIds.length ? { userId: { in: demoUserIds } } : {},
        demoOrgIds.length ? { orgId: { in: demoOrgIds } } : {},
        demoEventIds.length ? { eventId: { in: demoEventIds } } : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
  });

  // Supprime les orgs demo (cascade events, categories, registrations,
  // memberships, blockedEmail/Document, eventSettings, categoryTemplates).
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: "demo-" } },
  });

  // Supprime les users demo (sauf admin et participant historiques, qu'on
  // garde mais dont on mettra le password a 123456 plus bas).
  await prisma.user.deleteMany({
    where: {
      email: { contains: DEMO_DOMAIN },
    },
  });

  console.log("Cleanup termine.");
}

// ============================================================
// Main seed
// ============================================================

async function main() {
  console.log(`Seed demarre. Tous les passwords seront ${DEMO_PASSWORD}.`);

  await cleanup();

  // 1. PlatformSettings
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: process.env.PLATFORM_SMTP_HOST || "mailpit",
      smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || "1025", 10),
      smtpFrom: process.env.PLATFORM_SMTP_FROM || "noreply@badge.local",
      smtpUser: process.env.PLATFORM_SMTP_USER || "",
      smtpPassword: process.env.PLATFORM_SMTP_PASSWORD || "",
      smtpSecure: process.env.PLATFORM_SMTP_SECURE === "true",
      recaptchaEnabled: false,
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      badgeTemplateId: "default-v1",
    },
    update: {},
  });

  // 1b. Plans d'abonnement par defaut (v4). Upsert par nom (unique).
  await prisma.plan.upsert({
    where: { name: "Gratuit" },
    create: { name: "Gratuit", maxEvents: 1, maxParticipantsPerEvent: 100 },
    update: {},
  });
  await prisma.plan.upsert({
    where: { name: "Standard" },
    create: { name: "Standard", maxEvents: 10, maxParticipantsPerEvent: 1000 },
    update: {},
  });
  console.log("Plans par defaut (Gratuit, Standard) prets.");

  // 2. Pre-hash unique du password demo (gain ~60s sur 240 hashes).
  const passwordHash = await hash(DEMO_PASSWORD, 12);
  console.log("Password hash pre-calcule.");

  // 3. Staff users -- upsert pour les comptes historiques + 3 nouveaux roles.
  const staffSeeds: Array<{ email: string; name: string; role: StaffRole }> = [
    { email: "admin@badge.local", name: "Super Admin", role: StaffRole.SUPER_ADMIN },
    { email: "admin2@badge.local", name: "Admin 2", role: StaffRole.STAFF_ADMIN },
    { email: "support@badge.local", name: "Support Staff", role: StaffRole.STAFF_SUPPORT },
    { email: "observer@badge.local", name: "Observer Staff", role: StaffRole.STAFF_OBSERVER },
  ];

  for (const s of staffSeeds) {
    await prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        password: passwordHash,
        name: s.name,
        isStaff: true,
        staffRole: s.role,
        emailVerifiedAt: new Date(),
      },
      update: {
        password: passwordHash,
        isStaff: true,
        staffRole: s.role,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log(`Staff users seedes : ${staffSeeds.map((s) => s.email).join(", ")}`);

  // 4. Participant historique avec profil complet.
  await prisma.user.upsert({
    where: { email: "participant@badge.local" },
    create: {
      email: "participant@badge.local",
      password: passwordHash,
      name: "Awa Diallo",
      isStaff: false,
      emailVerifiedAt: new Date(),
      firstName: "Awa",
      lastName: "Diallo",
      structure: "Universite Felix Houphouet-Boigny",
      photo: "uploads/profile/seed/awa-photo.jpg",
      idDocumentType: "CNI",
      idDocumentNumber: "CI-AWA-001",
      idDocument: "uploads/profile/seed/awa-cni.pdf",
      participantProfileCompletedAt: new Date(),
    },
    update: { password: passwordHash, emailVerifiedAt: new Date() },
  });
  console.log("Participant historique seede : participant@badge.local");

  // ADR 2026-06-01 (v2-14 Task 15) : branchement minimal vs demo.
  // Defaut (production-safe) -> s'arrete ici. Smoke test "0 org / 0 event" reste vert.
  // SEED_MODE=demo -> continue avec 10 orgs + 30 events + 200 participants ci-dessous.
  if (process.env.SEED_MODE !== "demo") {
    console.log("Seed minimal termine. Pour le seed de demonstration : SEED_MODE=demo");
    return;
  }

  console.log("Mode demo active -- creation orgs/events/participants...");

  // 5. 10 Organisations + leur ecosysteme.
  const orgEvents: Array<{ orgId: string; orgSlug: string; eventId: string; eventSlug: string; eventDate: Date; isActive: boolean; categories: Array<{ id: string; number: number; name: string }> }> = [];

  for (const orgDef of ORGS) {
    const orgSlug = `demo-${orgDef.slug}`;

    const org = await prisma.organization.create({
      data: {
        slug: orgSlug,
        name: orgDef.name,
        legalName: orgDef.legalName,
        addressLine1: `${randInt(1, 200)} avenue de l'Independance`,
        city: orgDef.city,
        country: "Cote d'Ivoire",
        taxId: orgDef.taxId,
        website: `https://${orgDef.slug}.example.ci`,
        contactEmail: `contact@${orgDef.slug}.example.ci`,
        contactPhone: `+225 27 22 ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
        archived: orgDef.archived ?? false,
        archivedAt: orgDef.archived ? new Date() : null,
      },
    });

    // 5a. Membres org : OWNER, MANAGER, AUDITOR
    const orgMembers: Array<{ email: string; role: OrgRole }> = [
      { email: `owner-${orgDef.slug}${DEMO_DOMAIN}`, role: OrgRole.OWNER },
      { email: `manager-${orgDef.slug}${DEMO_DOMAIN}`, role: OrgRole.MANAGER },
      { email: `auditor-${orgDef.slug}${DEMO_DOMAIN}`, role: OrgRole.AUDITOR },
    ];

    for (const m of orgMembers) {
      const n = fakeName();
      const user = await prisma.user.create({
        data: {
          email: m.email,
          password: passwordHash,
          name: n.full,
          isStaff: false,
          emailVerifiedAt: new Date(),
        },
      });
      await prisma.orgMembership.create({
        data: { userId: user.id, orgId: org.id, role: m.role },
      });
    }

    // 5b. CategoryTemplates (3-5 par org).
    const templates = pickN(TEMPLATE_NAMES, randInt(3, 5));
    let tNumber = 1;
    for (const t of templates) {
      await prisma.categoryTemplate.create({
        data: {
          orgId: org.id,
          name: t.name,
          color: t.color,
          number: tNumber++,
        },
      });
    }

    // 5c. Events : 3 par org -- 1 passe, 1 en cours, 1 futur.
    const eventDefs = pickN(EVENT_TEMPLATES, 3);
    const eventStates: Array<{ daysOffset: number; registrationOpen: boolean; archived: boolean; isActive: boolean }> = [
      { daysOffset: -randInt(30, 90), registrationOpen: false, archived: rand() < 0.3, isActive: false },
      { daysOffset: randInt(5, 20), registrationOpen: true, archived: false, isActive: true },
      { daysOffset: randInt(45, 120), registrationOpen: false, archived: false, isActive: false },
    ];

    for (let i = 0; i < 3; i++) {
      const ed = eventDefs[i];
      const state = eventStates[i];
      const eventSlug = `demo-${orgDef.slug}-${ed.key}`;
      const eventDate = daysFromNow(state.daysOffset);

      const event = await prisma.event.create({
        data: {
          orgId: org.id,
          title: `${ed.title} ${eventDate.getFullYear()}`,
          slug: eventSlug,
          location: ed.location,
          date: eventDate,
          registrationOpen: state.registrationOpen,
          archived: state.archived,
          archivedAt: state.archived ? new Date() : null,
        },
      });

      // EventSettings : contact override pour 30 % des events.
      if (rand() < 0.3) {
        await prisma.eventSettings.create({
          data: {
            eventId: event.id,
            contactEmail: `event-${orgDef.slug}@example.ci`,
            contactPhone: `+225 27 22 ${randInt(10, 99)} 00 00`,
          },
        });
      }

      // Categories : 2-4 par event, numbers uniques.
      const cats = pickN(CATEGORY_NAMES, randInt(2, 4));
      const eventCats: Array<{ id: string; number: number; name: string }> = [];
      let cNum = 1;
      for (const c of cats) {
        const category = await prisma.category.create({
          data: {
            eventId: event.id,
            name: c.name,
            color: c.color,
            number: cNum,
            neutralBadge: c.neutralBadge,
            anonymous: c.anonymous,
          },
        });
        eventCats.push({ id: category.id, number: cNum, name: c.name });
        cNum++;
      }

      // BlockedEmail / BlockedDocument : 0-2 par event en cours.
      if (state.isActive && rand() < 0.6) {
        await prisma.blockedEmail.create({
          data: {
            eventId: event.id,
            email: `blocked-${randInt(1, 999)}@spam.test`,
            reason: "Spam detecte lors d'une precedente inscription.",
          },
        });
      }
      if (state.isActive && rand() < 0.4) {
        await prisma.blockedDocument.create({
          data: {
            eventId: event.id,
            documentNumber: `CI-BLOCKED-${randInt(100, 999)}`,
            reason: "Document signale comme frauduleux.",
          },
        });
      }

      orgEvents.push({
        orgId: org.id,
        orgSlug,
        eventId: event.id,
        eventSlug,
        eventDate,
        isActive: state.isActive,
        categories: eventCats,
      });
    }
  }
  console.log(`Orgs creees : ${ORGS.length}, events crees : ${orgEvents.length}`);

  // 6. 200 participants avec profil complet.
  const participants: Array<{ id: string; email: string; firstName: string; lastName: string; structure: string }> = [];
  for (let i = 1; i <= 200; i++) {
    const n = fakeName();
    const idx = String(i).padStart(3, "0");
    const email = `participant-${idx}${DEMO_DOMAIN}`;
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name: n.full,
        isStaff: false,
        emailVerifiedAt: new Date(),
        firstName: n.firstName,
        lastName: n.lastName,
        structure: fakeStructure(),
        photo: "uploads/profile/seed/awa-photo.jpg",
        idDocumentType: "CNI",
        idDocumentNumber: `CI-${idx}-${randInt(1000, 9999)}`,
        idDocument: "uploads/profile/seed/awa-cni.pdf",
        participantProfileCompletedAt: new Date(),
      },
    });
    participants.push({
      id: user.id,
      email,
      firstName: n.firstName,
      lastName: n.lastName,
      structure: user.structure!,
    });
  }
  console.log(`Participants seedes : ${participants.length}`);

  // 7. Registrations : chaque participant s'inscrit a 1-2 events.
  //    Distribution statut : 40 % PENDING, 40 % APPROVED, 20 % REJECTED.
  let regCount = 0;
  const seqByCategory = new Map<string, number>();
  for (const p of participants) {
    const targetEvents = pickN(orgEvents, randInt(1, 2));
    for (const ev of targetEvents) {
      // Eviter @@unique([userId, eventId]) en cas de pick redondant.
      const cat = pick(ev.categories);
      const seqKey = `${ev.eventId}:${cat.id}`;
      const nextSeq = (seqByCategory.get(seqKey) ?? 0) + 1;
      seqByCategory.set(seqKey, nextSeq);

      const id = generateId({
        categoryNumber: cat.number,
        date: ev.eventDate.toISOString(),
        sequentialNumber: nextSeq,
      });

      const roll = rand();
      const status: RegistrationStatus =
        roll < 0.4 ? RegistrationStatus.PENDING : roll < 0.8 ? RegistrationStatus.APPROVED : RegistrationStatus.REJECTED;

      const rej = status === RegistrationStatus.REJECTED ? pick(REJECTION_REASONS) : null;
      const isPrinted = status === RegistrationStatus.APPROVED && rand() < 0.5;

      try {
        await prisma.registration.create({
          data: {
            id,
            eventId: ev.eventId,
            categoryId: cat.id,
            userId: p.id,
            status,
            badgePrinted: isPrinted,
            badgePrintedAt: isPrinted ? new Date() : null,
            allAccessGranted: status === RegistrationStatus.APPROVED && rand() < 0.1,
            rejectionReason: rej?.reason ?? null,
            rejectionDetails: rej?.details ?? null,
            snapshotFirstName: p.firstName,
            snapshotLastName: p.lastName,
            snapshotEmail: p.email,
            snapshotStructure: p.structure,
            snapshotPhoto: "uploads/profile/seed/awa-photo.jpg",
            snapshotIdDocumentType: "CNI",
            snapshotIdDocumentNumber: `CI-${p.id.slice(-6).toUpperCase()}`,
            snapshotIdDocument: "uploads/profile/seed/awa-cni.pdf",
          },
        });
        regCount++;
      } catch (err: unknown) {
        // Conflit @@unique([userId, eventId]) : on ignore (participant deja
        // inscrit sur l'event a cause du pick double).
        if (!(err instanceof Error) || !err.message.includes("Unique constraint")) {
          throw err;
        }
      }
    }
  }
  console.log(`Registrations seedees : ${regCount}`);

  // 8. Recap final
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.event.count(),
    prisma.category.count(),
    prisma.registration.count(),
    prisma.orgMembership.count(),
  ]);
  console.log(`\n=== Recap final ===`);
  console.log(`Users         : ${counts[0]}`);
  console.log(`Organizations : ${counts[1]}`);
  console.log(`Events        : ${counts[2]}`);
  console.log(`Categories    : ${counts[3]}`);
  console.log(`Registrations : ${counts[4]}`);
  console.log(`OrgMemberships: ${counts[5]}`);
  console.log(`\nTous les passwords sont : ${DEMO_PASSWORD}`);
  console.log(`Comptes cles :`);
  console.log(`  admin@badge.local          (SUPER_ADMIN)`);
  console.log(`  admin2@badge.local         (STAFF_ADMIN)`);
  console.log(`  support@badge.local        (STAFF_SUPPORT)`);
  console.log(`  observer@badge.local       (STAFF_OBSERVER)`);
  console.log(`  participant@badge.local    (participant historique)`);
  console.log(`  owner-acme@demo.local      (OWNER de Acme Corporation)`);
  console.log(`  manager-acme@demo.local    (MANAGER de Acme Corporation)`);
  console.log(`  auditor-acme@demo.local    (AUDITOR de Acme Corporation)`);
  console.log(`  participant-001@demo.local (... jusqu'a participant-200)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
