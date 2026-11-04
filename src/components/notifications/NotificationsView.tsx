import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { InvalidCursorError, listNotifications } from "@/lib/notifications/queries";
import { notificationsPagePath, type NotificationScopeRef } from "@/lib/notifications/scope";
import { isAnchored, splitBodyByAnchors } from "@/lib/notifications/split-body";
import type { NotificationDTO } from "@/lib/notifications/types";
import { MarkAllReadButton } from "./MarkAllReadButton";

export function NotificationsList({ items, now }: { items: NotificationDTO[]; now: Date }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => {
        const [primary, ...secondary] = n.links;
        const primaryInBody = isAnchored(n.body, primary);
        const segments = splitBodyByAnchors(n.body, n.links);
        const loose = secondary.filter((l) => !isAnchored(n.body, l));
        const titleClass = `text-sm text-slate-900 ${n.readAt === null ? "font-semibold" : "font-medium"}`;
        return (
          <li
            key={n.id}
            id={`n-${n.id}`}
            className="scroll-mt-20 px-4 py-4 target:ring-2 target:ring-inset target:ring-navy sm:px-6"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className={titleClass}>
                {primary && !primaryInBody ? (
                  <Link href={primary.href} className="hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </h2>
              {n.readAt === null ? (
                <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-medium text-navy">
                  Non lue
                </span>
              ) : null}
              <span className="text-xs text-slate-400">{formatRelativeTime(n.createdAt, now)}</span>
            </div>
            <p className="mt-1 text-[13px] text-slate-600">
              {segments.map((seg, i) =>
                seg.href ? (
                  <Link key={i} href={seg.href} className="font-medium text-navy hover:underline">
                    {seg.text}
                  </Link>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
            {loose.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {loose.map((l) => (
                  <Link key={l.href} href={l.href} className="text-[13px] font-medium text-navy hover:underline">
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function filterHref(base: string, unread: boolean): string {
  return unread ? `${base}?unread=1` : base;
}

export async function NotificationsView({
  userId,
  scope,
  searchParams,
}: {
  userId: string;
  scope: NotificationScopeRef;
  searchParams: { unread?: string; cursor?: string };
}) {
  const unreadOnly = searchParams.unread === "1";
  const base = notificationsPagePath(scope);
  let page: Awaited<ReturnType<typeof listNotifications>>;
  let hasCursor = !!searchParams.cursor;
  try {
    page = await listNotifications(userId, scope, { cursor: searchParams.cursor, unreadOnly });
  } catch (err) {
    if (!(err instanceof InvalidCursorError)) throw err;
    page = await listNotifications(userId, scope, { unreadOnly });
    hasCursor = false;
  }
  const query = (cursor: string) => `${base}?${unreadOnly ? "unread=1&" : ""}cursor=${encodeURIComponent(cursor)}`;
  const tab = (active: boolean) =>
    `inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-medium ${
      active ? "bg-slate-900 text-white" : "bg-mist text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-navy">Notifications</h1>
        <MarkAllReadButton scope={scope} />
      </div>
      <nav aria-label="Filtre des notifications" className="flex flex-wrap gap-2">
        <Link href={filterHref(base, false)} aria-current={unreadOnly ? undefined : "page"} className={tab(!unreadOnly)}>
          Toutes
        </Link>
        <Link href={filterHref(base, true)} aria-current={unreadOnly ? "page" : undefined} className={tab(unreadOnly)}>
          Non lues seulement
        </Link>
      </nav>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState icon="inbox" title={unreadOnly ? "Aucune notification non lue" : "Aucune notification"} />
        ) : (
          <NotificationsList items={page.items} now={new Date()} />
        )}
      </Card>
      {hasCursor || page.nextCursor ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-medium">
          {hasCursor ? (
            <Link href={filterHref(base, unreadOnly)} className="text-navy hover:text-navy-hover">
              Revenir aux plus récentes
            </Link>
          ) : (
            <span />
          )}
          {page.nextCursor ? (
            <Link href={query(page.nextCursor)} className="text-navy hover:text-navy-hover">
              Notifications plus anciennes
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
