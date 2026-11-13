import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { getApprovedPhotoUrl } from "@/lib/approved-photo";
import { countOrdersWithUnread } from "@/lib/print-requests/read-state";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { EventShell } from "@/components/event/EventShell";

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
  // d'acces (permissions effectives), sans dependre du layout org parent.
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

  const permissions = effectivePermissions(ctx, { kind: "event", eventId: event.id, orgId: event.orgId });
  if (permissions.size === 0) redirect("/select");
  const photoUrl = await getApprovedPhotoUrl(ctx.user.id);

  // Meme definition que `EventAuthCtx.isStaffActor` : staff sans appartenance a l'organisation ni a l'evenement.
  const isStaffMode =
    ctx.isStaff &&
    !ctx.orgMemberships.some((m) => m.orgId === event.orgId) &&
    !ctx.eventMemberships.some((m) => m.eventId === event.id);

  // Compteur du menu « Impression » : seulement pour qui voit l'entree (permission `print.request`),
  // limite a l'evenement courant ; le staff en consultation n'enregistre pas de lecture.
  const printUnread =
    permissions.has("print.request") && !ctx.isStaff
      ? await countOrdersWithUnread(ctx.user.id, "ORGANIZER", { eventId: event.id })
      : 0;

  return (
    <EventShell
      org={{ id: event.organization.id, name: event.organization.name }}
      event={event}
      permissions={[...permissions]}
      isStaffMode={isStaffMode}
      printUnread={printUnread}
      orgLinkEnabled={hasPermission(ctx, "org.events.list", { kind: "org", orgId: event.orgId })}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      photoUrl={photoUrl}
    >
      {children}
    </EventShell>
  );
}
