"use client";

// Tiroir de navigation mobile : état d'ouverture partagé entre le bouton de l'en-tête
// (MobileNavToggle) et l'aside (MobileNavPanel). Voir AppShell pour la composition.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const PANEL_ID = "app-shell-nav";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  isDesktop: boolean;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("MobileNav* doit être rendu dans un MobileNavProvider");
  return ctx;
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Faux au rendu serveur : le tiroir fermé est inert ; la media query le retire au montage.
  const [isDesktop, setIsDesktop] = useState(false);
  const [lastPathname, setLastPathname] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);
  const pathname = usePathname();

  // Fermeture au changement de route (ajustement d'état pendant le rendu).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktop(mq.matches);
      // Passer au bureau avec le tiroir ouvert : on le referme.
      if (mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Le focus revient sur le bouton menu à la fermeture (pas au montage).
  useEffect(() => {
    if (wasOpen.current && !open) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, isDesktop, toggleRef }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function MobileNavToggle() {
  const { open, setOpen, toggleRef } = useMobileNav();
  return (
    <button
      ref={toggleRef}
      type="button"
      aria-label="Ouvrir le menu"
      aria-expanded={open}
      aria-controls={PANEL_ID}
      onClick={() => setOpen(true)}
      className="-ml-1 flex h-10 w-10 flex-none items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-mist lg:hidden"
    >
      <Icon name="menu" size={20} />
    </button>
  );
}

export function MobileNavPanel({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { open, setOpen, isDesktop } = useMobileNav();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const closed = !open && !isDesktop;

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Voile : toujours rendu pour pouvoir s'estomper (fondu) plutôt que d'apparaître d'un coup */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ease-out motion-reduce:transition-none lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id={PANEL_ID}
        inert={closed}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none lg:visible lg:static lg:z-auto lg:w-56 lg:flex-none lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${closed ? "invisible" : ""}`}
      >
        {/* En-tête fixe : bouton de fermeture (mobile) + marque / contexte */}
        <div className="flex-none px-3 pt-4">
          <button
            ref={closeRef}
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="-mt-1 mb-1 ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-nav-muted transition-colors hover:bg-mist hover:text-navy lg:hidden"
          >
            <Icon name="x" size={20} />
          </button>
          {header}
        </div>
        {/* Navigation : seule zone qui défile quand la hauteur de l'écran est faible */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {children}
        </div>
        {/* Pied fixe : la déconnexion reste toujours visible */}
        {footer ? (
          <div className="flex flex-none flex-col gap-1 border-t border-line px-3 py-3">{footer}</div>
        ) : null}
      </aside>
    </>
  );
}
