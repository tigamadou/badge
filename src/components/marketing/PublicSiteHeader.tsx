"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const NAV = [
  { id: "fonctionnalites", label: "Fonctionnalités", href: "/fonctionnalites" },
  { id: "tarifs", label: "Tarifs", href: "/tarifs" },
  { id: "apropos", label: "À propos", href: "/a-propos" },
  { id: "contact", label: "Contact", href: "/contact" },
] as const;

function deriveActive(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname.startsWith("/fonctionnalites")) return "fonctionnalites";
  if (pathname.startsWith("/tarifs")) return "tarifs";
  if (pathname.startsWith("/a-propos")) return "apropos";
  if (pathname.startsWith("/contact")) return "contact";
  return null;
}

export function PublicSiteHeader() {
  const [open, setOpen] = useState(false);
  const active = deriveActive(usePathname());

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-8 px-7">
        <Link href="/" className="flex items-center" aria-label="Badge — accueil">
          <Image src="/logo.svg" alt="Badge" width={118} height={36} className="h-9 w-auto" priority />
        </Link>
        <nav aria-label="Navigation principale" className="hidden gap-7 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={`text-sm font-medium transition-colors hover:text-slate-900 ${
                active === n.id ? "text-navy underline decoration-gold decoration-2 underline-offset-8" : "text-slate-600"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            href="/login"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-navy hover:bg-mist"
          >
            Se connecter
          </Link>
          <Link
            href="/contact"
            className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-hover"
          >
            Demander une démo
          </Link>
        </div>
        <button
          type="button"
          className="p-1.5 text-slate-900 md:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="menu" size={22} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-white px-7 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Navigation mobile">
            {NAV.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className="text-sm font-medium text-slate-700"
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/login" className="mt-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>
              Se connecter
            </Link>
            <Link
              href="/contact"
              className="rounded-lg bg-navy px-3 py-2 text-center text-sm font-medium text-white"
              onClick={() => setOpen(false)}
            >
              Demander une démo
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
