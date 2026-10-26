import Image from "next/image";
import { formatEventPeriod } from "@/lib/format-date";
import { EventCover, eventCoverUrl } from "@/components/event/EventCover";

type Props = {
  // ADR 2026-06-01 (v2-14 Task 12) : `organization` ajoute pour cascade logo
  // (Event.logo -> Org.logo) et lien website footer.
  event: {
    title: string;
    date: Date | string;
    endDate?: Date | string | null;
    location: string;
    logo?: string | null;
    banner?: string | null;
  };
  organization?: { logo?: string | null; website?: string | null };
  contact?: { email?: string; phone?: string };
  children: React.ReactNode;
};

export function PublicEventLayout({ event, organization, contact, children }: Props) {
  const logoKey = event.logo ?? organization?.logo ?? null;
  const coverUrl = eventCoverUrl(event.banner);

  // Initiales de l'événement pour le placeholder quand il n'y a pas de logo.
  const initials = event.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Bannière marine — hero événement */}
      <header className="bg-brand-navy py-7 text-white">
        <div className="mx-auto flex max-w-[720px] items-center gap-4 px-5">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl bg-white/10">
            {logoKey ? (
              <Image
                src={`/api/files/${logoKey}`}
                alt={event.title}
                width={52}
                height={52}
                className="h-[52px] w-[52px] rounded-xl object-contain"
              />
            ) : (
              <span className="text-base font-bold">{initials}</span>
            )}
          </div>
          <div>
            <h1 className="text-[22px] font-semibold">{event.title}</h1>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-white/75">
              <span>{formatEventPeriod(event.date as Date, event.endDate ?? null)}</span>
              {event.location && <span>{event.location}</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-8">
        {coverUrl && (
          <div className="mb-6">
            <EventCover bannerUrl={coverUrl} title={event.title} variant="hero" />
          </div>
        )}
        {children}
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-[720px] px-5 py-4 text-center text-xs text-neutral-500">
          {(contact?.email || contact?.phone) && (
            <p>
              Contact :{" "}
              {contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact?.email && contact?.phone && " — "}
              {contact?.phone}
            </p>
          )}
          {organization?.website && (
            <p className="mt-1">
              <a
                href={organization.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {organization.website}
              </a>
            </p>
          )}
          <p className="mt-1">Propulsé par Badge</p>
        </div>
      </footer>
    </div>
  );
}
