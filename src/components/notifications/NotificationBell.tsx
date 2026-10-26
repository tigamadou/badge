"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { scopeToSearchParams, type NotificationScopeRef } from "@/lib/notifications/scope";
import { NotificationPanel } from "./NotificationPanel";
import { createUnreadPoller, formatBadgeCount } from "./unread-poller";

export type { NotificationScopeRef } from "@/lib/notifications/scope";

export function NotificationBellButton({
  count,
  open,
  onToggle,
  buttonRef,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const badge = formatBadgeCount(count);
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={count > 0 ? `Notifications, ${count} non lues` : "Notifications"}
      aria-expanded={open}
      aria-haspopup="dialog"
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
    >
      <Bell size={20} aria-hidden="true" />
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function NotificationBell({ scope }: { scope: NotificationScopeRef }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  // Le panneau est lié à la page où il a été ouvert : il se ferme seul quand la route change.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const scopeQuery = scopeToSearchParams(scope).toString();

  useEffect(() => {
    const poller = createUnreadPoller({
      fetchCount: async () => {
        const res = await fetch(`/api/notifications/unread-count?${scopeQuery}`, { cache: "no-store" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("unread-count");
        return ((await res.json()) as { count: number }).count;
      },
      onCount: setCount,
      doc: document,
    });
    refreshRef.current = poller.refresh;
    poller.start();
    return () => poller.stop();
  }, [scopeQuery]);

  function close(restoreFocus = false) {
    setOpenPath(null);
    if (restoreFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <NotificationBellButton
        count={count}
        open={open}
        buttonRef={buttonRef}
        onToggle={() => setOpenPath(open ? null : pathname)}
      />
      {open ? (
        <NotificationPanel
          scope={scope}
          onClose={() => close(true)}
          onChanged={() => void refreshRef.current()}
        />
      ) : null}
    </div>
  );
}
