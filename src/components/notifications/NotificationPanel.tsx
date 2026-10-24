"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  notificationsPagePath,
  scopeToSearchParams,
  type NotificationScopeRef,
} from "@/lib/notifications/scope";
import type { NotificationDTO } from "@/lib/notifications/types";

const PANEL_SIZE = 10;

export function NotificationPanelList({
  items,
  now,
  onSelect,
}: {
  items: NotificationDTO[];
  now: Date;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState icon="inbox" title="Aucune notification" />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <span className="mt-1.5 flex h-2 w-2 flex-none">
              {n.readAt === null ? (
                <span aria-label="Non lue" role="img" className="h-2 w-2 rounded-full bg-green-600" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm text-slate-900 ${n.readAt === null ? "font-semibold" : "font-medium"}`}>
                {n.title}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] text-slate-500">{n.body}</span>
              <span className="mt-1 block text-xs text-slate-400">{formatRelativeTime(n.createdAt, now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function NotificationPanel({
  scope,
  onClose,
  onChanged,
}: {
  scope: NotificationScopeRef;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [failed, setFailed] = useState(false);
  const query = scopeToSearchParams(scope);
  query.set("limit", String(PANEL_SIZE));
  const queryString = query.toString();
  const pagePath = notificationsPagePath(scope);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notifications?${queryString}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch");
        return res.json() as Promise<{ items: NotificationDTO[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString, reloadKey]);

  async function select(id: string) {
    await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }).catch(() => undefined);
    router.push(`${pagePath}#n-${id}`);
    onClose();
    onChanged();
  }

  async function markAllRead() {
    const params = scopeToSearchParams(scope).toString();
    await fetch(`/api/notifications/read-all?${params}`, { method: "POST" }).catch(() => undefined);
    setReloadKey((k) => k + 1);
    onChanged();
  }

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="fixed inset-0 z-50 flex flex-col bg-white sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[70vh] sm:w-96 sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-lg"
    >
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">Notifications</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les notifications"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:hidden"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <p className="px-4 py-10 text-center text-[13px] text-slate-500">
            Impossible de charger les notifications.
          </p>
        ) : items === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <NotificationPanelList items={items} now={new Date()} onSelect={select} />
        )}
      </div>
      <div className="flex flex-none items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[13px]">
        <button type="button" onClick={markAllRead} className="font-medium text-slate-600 hover:text-slate-900">
          Tout marquer comme lu
        </button>
        <Link href={pagePath} onClick={onClose} className="font-medium text-green-700 hover:text-green-800">
          Voir toutes les notifications
        </Link>
      </div>
    </div>
  );
}
