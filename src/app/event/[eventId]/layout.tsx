import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { countOrdersWithUnread } from "@/lib/print-requests/read-state";
import { effectiveEventRole, hasOrgRole } from "@/lib/auth-helpers";
import { EventShell } from "@/components/event/EventShell";
import { EventOperatorShell } from "@/components/event/EventOperatorShell";
import { EventPrinterShell } from "@/components/event/EventPrinterShell";
import { EventViewerShell } from "@/components/event/EventViewerShell";

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ eventId: string }>;
  children: React.ReactNode;
}) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/event/${eventId}`);
  }

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  // v4 Bloc D : espace evenement top-level `/event/[eventId]`. L'orgId n'est plus
  // dans l'URL ; il est resolu depuis l'evenement. Ce layout gere son PROPRE controle
  // d'acces (via effectiveEventRole), sans dependre du layout org parent.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      archived: true,
      registrationOpen: true,
      orgId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!event) notFound();

  const role = effectiveEventRole(ctx, event.id, event.orgId);
  if (!role) {
    redirect("/select");
  }
  const photoUrl = await getApprovedPhotoUrl(ctx.user.id);

  const isStaffMode =
    ctx.isStaff &&
    !hasOrgRole(ctx, event.orgId, "OWNER") &&
    !ctx.eventMemberships.some((m) => m.eventId === event.id);

  if (role === "OPERATOR") {
    return (
      <EventOperatorShell
        org={{ id: event.organization.id, name: event.organization.name }}
        event={{ id: event.id, title: event.title }}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        photoUrl={photoUrl}
      >
        {children}
      </EventOperatorShell>
    );
  }

  // ADR 2026-06-01 (v2-14 Task 4) : shells dedies PRINTER et VIEWER.
  if (role === "PRINTER") {
    return (
      <EventPrinterShell
        org={{ id: event.organization.id, name: event.organization.name }}
        event={{ id: event.id, title: event.title }}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        photoUrl={photoUrl}
      >
        {children}
      </EventPrinterShell>
    );
  }

  if (role === "VIEWER") {
    return (
      <EventViewerShell
        org={{ id: event.organization.id, name: event.organization.name }}
        event={{ id: event.id, title: event.title }}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        photoUrl={photoUrl}
      >
        {children}
      </EventViewerShell>
    );
  }

  // Compteur du menu « Impression » : seulement pour qui voit l'entrée (permission `print.request`),
  // limité à l'évènement courant ; le staff en consultation n'enregistre pas de lecture.
  const printUnread =
    (role === "ADMIN" || role === "STAFF") && !ctx.isStaff
      ? await countOrdersWithUnread(ctx.user.id, "ORGANIZER", { eventId: event.id })
      : 0;

  return (
    <EventShell
      org={{ id: event.organization.id, name: event.organization.name }}
      event={event}
      effectiveRole={role}
      isStaffMode={isStaffMode}
      printUnread={printUnread}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      photoUrl={photoUrl}
    >
      {children}
    </EventShell>
  );
}
