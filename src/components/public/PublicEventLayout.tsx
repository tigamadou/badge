import Image from "next/image";
import { formatEventDate } from "@/lib/format-date";

type Props = {
  event: { title: string; date: Date | string; location: string; logo?: string | null };
  contact?: { email?: string; phone?: string };
  children: React.ReactNode;
};

export function PublicEventLayout({ event, contact, children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          {event.logo && (
            <Image
              src={`/api/files/${event.logo}`}
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
          <p className="mt-1">Propulsé par Badge</p>
        </div>
      </footer>
    </div>
  );
}
