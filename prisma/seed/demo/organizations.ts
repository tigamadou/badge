import type { EventRole, OrgRole, Prisma } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma";
import { ensureSystemRoles, legacyKeyOf } from "../../../src/lib/permissions/db";
import type {
  DemoCategory, DemoContext, DemoEvent, DemoOrg, DemoUser, EventPhase, EventRoleKey, OrgRoleKey, OrgSize,
} from "./context";
import { installDemoTemplate } from "./templates";

type OrgSpec = { slug: string; name: string; size: OrgSize; city: string; phases: EventPhase[] };

// Structure fixe : tailles, slugs et phases d'evenements. ctx.scaled ne s'applique qu'aux volumes
// d'inscriptions (Task 7), jamais a cette table.
const ORGS: OrgSpec[] = [
  { slug: "demo-grosse-org", name: "Fédération Nationale des Événements", size: "huge", city: "Paris",
    phases: ["past", "past", "ongoing", "upcoming", "upcoming"] },
  { slug: "demo-moyenne-1", name: "Congrès Médical du Sud", size: "medium", city: "Lyon", phases: ["past", "ongoing", "upcoming"] },
  { slug: "demo-moyenne-2", name: "Salon de l'Industrie", size: "medium", city: "Lille", phases: ["past", "upcoming"] },
  { slug: "demo-moyenne-3", name: "Festival des Arts Numériques", size: "medium", city: "Nantes", phases: ["past", "ongoing", "upcoming"] },
  { slug: "demo-moyenne-4", name: "Forum des Universités", size: "medium", city: "Bordeaux", phases: ["ongoing", "upcoming"] },
  { slug: "demo-petite-1", name: "Association Les Amis du Livre", size: "small", city: "Toulouse", phases: ["past", "upcoming"] },
  { slug: "demo-petite-2", name: "Club d'Échecs de Rennes", size: "small", city: "Rennes", phases: ["past", "ongoing"] },
  { slug: "demo-petite-3", name: "Atelier Théâtre du Port", size: "small", city: "Marseille", phases: ["past", "upcoming"] },
  { slug: "demo-petite-4", name: "Coopérative Agricole du Val", size: "small", city: "Dijon", phases: ["ongoing", "upcoming"] },
  { slug: "demo-petite-5", name: "Maison des Jeunes", size: "small", city: "Grenoble", phases: ["past", "upcoming"] },
  { slug: "demo-petite-6", name: "Société Savante du Nord", size: "small", city: "Amiens", phases: ["past", "ongoing"] },
  { slug: "demo-archivee", name: "Ancienne Chambre de Commerce", size: "archived", city: "Strasbourg", phases: ["past"] },
];

type CategoryDef = { name: string; color: string; number: number; anonymous?: boolean; neutralBadge?: boolean };
const CATEGORY_POOL: CategoryDef[] = [
  { name: "Participant", color: "#2563EB", number: 1 },
  { name: "Intervenant", color: "#16A34A", number: 2 },
  { name: "VIP", color: "#D97706", number: 3 },
];
const SPECIAL_CATEGORIES: CategoryDef[] = [
  { name: "Confidentiel", color: "#4B5563", number: 4, anonymous: true, neutralBadge: false },
  { name: "Visiteur", color: "#0891B2", number: 4, anonymous: false, neutralBadge: true },
];

const EVENT_THEMES = ["Assemblée annuelle", "Conférence", "Salon", "Journées professionnelles", "Gala", "Séminaire", "Rencontres"];
const SECURITY_INSTRUCTIONS = [
  "Porter son badge de manière visible en permanence.",
  "En cas d'évacuation, rejoindre le point de rassemblement indiqué.",
  "Les sacs peuvent être inspectés à l'entrée.",
];

const orgRoles = (): Record<OrgRoleKey, DemoUser[]> => ({ OWNER: [], MANAGER: [], AUDITOR: [], AGENT: [] });
const eventRoles = (): Record<EventRoleKey, DemoUser[]> => ({ ADMIN: [], OPERATOR: [], PRINTER: [], VIEWER: [] });

export async function seedOrganizationsAndEvents(ctx: DemoContext): Promise<void> {
  const { faker, registry, dates, images } = ctx;
  const pick = <T,>(list: T[], i: number): T => list[i % list.length];

  const templateDefault = await installDemoTemplate(ctx, { family: "demo-standard", label: "Badge standard (démo)", source: "default" });
  const templateRecto = await installDemoTemplate(ctx, { family: "demo-recto-verso", label: "Badge recto-verso (démo)", source: "recto-verso" });

  let eventCounter = 0;
  for (const [orgIndex, spec] of ORGS.entries()) {
    const archivedOrg = spec.size === "archived";
    const orgTemplate = spec.slug === "demo-grosse-org" ? templateRecto : spec.slug === "demo-moyenne-1" ? templateDefault : null;
    const orgRow = await prisma.organization.create({
      data: {
        name: spec.name,
        legalName: `${spec.name} SAS`,
        slug: spec.slug,
        addressLine1: faker.location.streetAddress(),
        postalCode: faker.location.zipCode(),
        city: spec.city,
        country: "France",
        taxId: `FR${faker.string.numeric(11)}`,
        website: `https://${spec.slug}.demo.local`,
        logo: pick(images.logos, orgIndex),
        contactEmail: `contact@${spec.slug}.demo.local`,
        contactPhone: faker.phone.number({ style: "international" }),
        archived: archivedOrg,
        archivedAt: archivedOrg ? dates.daysAgo(40) : null,
        badgeTemplateId: orgTemplate,
      },
    });
    await ctx.backdate("organization", orgRow.id, dates.between(300, 700));

    const org: DemoOrg = {
      id: orgRow.id, slug: spec.slug, name: spec.name, size: spec.size,
      archived: archivedOrg, badgeTemplateId: orgTemplate,
    };
    registry.orgs.push(org);
    registry.orgsBySize[spec.size].push(org);
    const orgEvents: DemoEvent[] = [];
    registry.eventsByOrg.set(org.id, orgEvents);

    await prisma.categoryTemplate.createMany({
      data: CATEGORY_POOL.map((c) => ({ orgId: org.id, name: c.name, color: c.color, number: c.number })),
    });

    for (const [phaseIndex, phase] of spec.phases.entries()) {
      const idx = eventCounter++;
      const huge = spec.size === "huge";
      const dayOffset = phaseIndex * 37 + (orgIndex % 5) * 3;
      const date = phase === "past" ? dates.daysAgo(60 + dayOffset)
        : phase === "ongoing" ? dates.daysAgo(1)
        : dates.daysFromNow(20 + dayOffset);
      const endDate = phase === "ongoing" ? dates.daysFromNow(2, 18)
        : idx % 4 === 3 ? null
        : new Date(date.getTime() + (1 + (idx % 3)) * 86_400_000);
      // Le premier evenement passe de la grosse organisation est archive ; l'organisation archivee l'est aussi.
      const archivedEvent = phase === "past" && ((huge && phaseIndex === 0) || archivedOrg);
      const registrationOpen = phase !== "past" && !archivedEvent && !archivedOrg;

      const catCount = huge ? 4 : 2 + (idx % 3);
      const special = SPECIAL_CATEGORIES[idx % 2];
      const catDefs = [...CATEGORY_POOL, special].slice(0, catCount === 4 ? 4 : catCount);
      const eventTemplate = huge && phase === "ongoing" ? templateDefault : null;
      const theme = pick(EVENT_THEMES, idx);

      const row = await prisma.event.create({
        data: {
          orgId: org.id,
          title: `${theme} ${spec.name.split(" ").slice(0, 2).join(" ")} ${date.getFullYear()}`,
          slug: `${spec.slug}-${phase}-${phaseIndex + 1}`,
          location: `${faker.location.streetAddress()}, ${spec.city}`,
          date,
          endDate,
          description: faker.lorem.paragraph(),
          logo: idx % 3 === 0 ? pick(images.logos, idx) : null,
          banner: idx % 2 === 0 ? pick(images.banners, idx) : null,
          securityInstructions: idx % 3 !== 1 ? (SECURITY_INSTRUCTIONS as unknown as Prisma.InputJsonValue) : undefined,
          registrationOpen,
          badgeTemplateId: eventTemplate,
          archived: archivedEvent,
          archivedAt: archivedEvent ? dates.daysAgo(10) : null,
          categories: {
            create: catDefs.map((c) => ({
              name: c.name, color: c.color, number: c.number,
              anonymous: c.anonymous ?? false,
              neutralBadge: c.neutralBadge ?? false,
            })),
          },
        },
        include: { categories: true },
      });
      await ctx.backdate("event", row.id, phase === "past" ? new Date(date.getTime() - 45 * 86_400_000) : dates.between(10, 60));

      const categories: DemoCategory[] = row.categories
        .map((c) => ({ id: c.id, number: c.number, name: c.name, anonymous: c.anonymous, neutralBadge: c.neutralBadge }))
        .sort((a, b) => a.number - b.number);
      const event: DemoEvent = {
        id: row.id, slug: row.slug, title: row.title, orgId: org.id, phase,
        date, endDate, archived: archivedEvent, registrationOpen,
        badgeTemplateId: eventTemplate, categories,
      };
      orgEvents.push(event);
      registry.events.push(event);
      registry.eventsByPhase[phase].push(event);

      if (idx % 2 === 0) {
        await prisma.eventSettings.create({
          data: { eventId: row.id, contactEmail: `evenement-${idx}@${spec.slug}.demo.local`, contactPhone: faker.phone.number({ style: "international" }) },
        });
      }
      if (!archivedOrg && !archivedEvent && (huge || idx % 3 === 0)) {
        await prisma.blockedEmail.createMany({
          data: [1, 2].map((n) => ({ eventId: row.id, email: `bloque.${n}@${spec.slug}.demo.local`, reason: "Adresse signalée pour abus" })),
        });
        await prisma.blockedDocument.createMany({
          data: [1, 2].map((n) => ({ eventId: row.id, documentNumber: `BLOQ-${idx}-${n}`, reason: "Document signalé comme falsifié" })),
        });
      }
    }
  }

  // Rattachements issus de la Task 5 : colonne d'enum heritee ET role systeme (roleId).
  const roleIds = await ensureSystemRoles(prisma);
  const orgBySlug = new Map(registry.orgs.map((o) => [o.slug, o]));
  const orgPairs = new Map<string, { userId: string; orgId: string; role: OrgRole | null; roleId: string }>();
  for (const m of registry.pendingOrgMembers) {
    const org = orgBySlug.get(m.orgSlug);
    if (!org) throw new Error(`Organisation de demo inconnue : ${m.orgSlug}`);
    const key = `${m.user.id}|${org.id}`;
    if (orgPairs.has(key)) continue;
    orgPairs.set(key, { userId: m.user.id, orgId: org.id, role: legacyKeyOf<"OrgRole">(m.role), roleId: roleIds[m.role] });
    const bucket = registry.orgMembers.get(org.id) ?? orgRoles();
    bucket[m.role].push(m.user);
    registry.orgMembers.set(org.id, bucket);
  }
  await prisma.orgMembership.createMany({ data: [...orgPairs.values()] });

  const eventPairs = new Map<string, { userId: string; eventId: string; role: EventRole | null; roleId: string }>();
  for (const m of registry.pendingEventMembers) {
    const org = orgBySlug.get(m.orgSlug);
    if (!org) throw new Error(`Organisation de demo inconnue : ${m.orgSlug}`);
    if (org.archived) throw new Error(`Rattachement d'evenement sur une organisation archivee : ${m.orgSlug}`);
    const candidates = (registry.eventsByOrg.get(org.id) ?? []).filter((e) => !e.archived);
    const event = m.phase === "any" ? candidates[0] : candidates.find((e) => e.phase === m.phase);
    if (!event) throw new Error(`Aucun evenement ${m.phase} pour ${m.orgSlug}`);
    const key = `${m.user.id}|${event.id}`;
    if (eventPairs.has(key)) continue;
    eventPairs.set(key, { userId: m.user.id, eventId: event.id, role: legacyKeyOf<"EventRole">(m.role), roleId: roleIds[m.role] });
    const bucket = registry.eventMembers.get(event.id) ?? eventRoles();
    bucket[m.role].push(m.user);
    registry.eventMembers.set(event.id, bucket);
  }
  await prisma.eventMembership.createMany({ data: [...eventPairs.values()] });
}
