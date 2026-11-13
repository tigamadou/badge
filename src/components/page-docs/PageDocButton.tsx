"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { matchDocRoute } from "@/lib/page-docs/match";
import { PageDocPanel, type PanelState } from "./PageDocPanel";

/** Bouton « ? » des gabarits d'espace : n'apparaît que si la page courante a une doc (spec 40). */
export function PageDocButton() {
  // Les tests des gabarits simulent un pathname nul : on le traite comme « aucune page documentée ».
  const pathname = usePathname() ?? "";
  // Le panneau est lié à la page où il a été ouvert : il se ferme seul quand la route change.
  const [openPath, setOpenPath] = useState<string | null>(null);
  // Page dont l'API a répondu 404 (doc retirée ou accès refusé) : le bouton disparaît.
  const [gonePath, setGonePath] = useState<string | null>(null);
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/page-docs?path=${encodeURIComponent(pathname)}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setGonePath(pathname);
          setOpenPath(null);
          return;
        }
        if (!res.ok) throw new Error("page-docs");
        setState({ status: "ready", doc: await res.json() });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, pathname, attempt]);

  const close = useCallback(() => {
    setOpenPath(null);
    buttonRef.current?.focus();
  }, []);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  if (!matchDocRoute(pathname) || gonePath === pathname) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) setState({ status: "loading" });
          setOpenPath(open ? null : pathname);
        }}
        aria-label="Aide sur cette page"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        <CircleHelp size={20} aria-hidden="true" />
      </button>
      {open ? (
        <PageDocPanel
          title={state.status === "ready" ? state.doc.title : "Aide sur cette page"}
          state={state}
          onClose={close}
          onRetry={retry}
        />
      ) : null}
    </>
  );
}
