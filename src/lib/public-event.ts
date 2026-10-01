import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import type { Event, Category, Organization } from "@prisma/client";
import type { PublicSettings } from "@/lib/settings";

export class PublicEventError extends Error {
  constructor(public code: "NOT_FOUND" | "CLOSED", message?: string) {
    super(message ?? code);
  }
}

export type PublicEventBundle = {
  // ADR 2026-06-01 (v2-14 Task 12) : `organization.logo` et `organization.website`
  // exposes pour cascade UI publique (fallback logo + lien website footer).
  event: Event & {
    organization: Pick<Organization, "id" | "name" | "slug" | "logo" | "website">;
  };
  categories: Category[];
  settings: PublicSettings;
};

export async function loadPublicEventBySlug(slug: string): Promise<PublicEventBundle> {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logo: true, website: true },
      },
    },
  });
  if (!event) throw new PublicEventError("NOT_FOUND");
  if (event.archived || !event.registrationOpen) throw new PublicEventError("CLOSED");

  const categories = await prisma.category.findMany({
    where: { eventId: event.id },
    orderBy: { number: "asc" },
  });

  const settings = await resolvePublicSettings(event.id);

  return { event, categories, settings };
}

// N'exclut PAS les events archives : /verify/[badgeId] doit pouvoir verifier les badges d'evenements passes.
export async function loadEventByIdForVerify(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, date: true, slug: true, archived: true },
  });
}
