import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole, hasOrgRole } from "@/lib/auth-helpers";
import { EventShell } from "@/components/event/EventShell";
import { EventOperatorShell } from "@/components/event/EventOperatorShell";

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  children: React.ReactNode;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/${orgId}/events/${eventId}`);
  }

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

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
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, event.id, event.orgId);
  if (!role) {
    redirect("/select");
  }

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
      >
        {children}
      </EventOperatorShell>
    );
  }

  return (
    <EventShell
      org={{ id: event.organization.id, name: event.organization.name }}
      event={event}
      effectiveRole={role}
      isStaffMode={isStaffMode}
      user={{ name: ctx.user.name, email: ctx.user.email }}
    >
      {children}
    </EventShell>
  );
}
