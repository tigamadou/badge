import Image from "next/image";
import { formatEventDate } from "@/lib/format-date";

type Props = {
  // ADR 2026-06-01 (v2-14 Task 12) : `organization` ajoute pour cascade logo
  // (Event.logo -> Org.logo) et lien website footer.
  event: { title: string; date: Date | string; location: string; logo?: string | null };
  organization?: { logo?: string | null; website?: string | null };
  contact?: { email?: string; phone?: string };
  children: React.ReactNode;
};

export function PublicEventLayout({ event, organization, contact, children }: Props) {
  const logoKey = event.logo ?? organization?.logo ?? null;
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          {logoKey && (
            <Image
              src={`/api/files/${logoKey}`}
              alt={event.title}
              width={56}
              height={56}
              className="h-14 w-14 rounded object-contain"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{event.title}</h1>
            <p className="text-sm text-neutral-600">
              {formatEventDate(event.date as Date)}
              {event.location ? ` — ${event.location}` : ""}
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center text-xs text-neutral-500">
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
