"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  userName: string;
  userRole: string;
  onMenuToggle: () => void;
}

export function Header({ userName, userRole, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
      <button
        onClick={onMenuToggle}
        className="md:hidden text-slate-600 hover:text-slate-900 transition-colors"
        aria-label="Ouvrir le menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">
          <Link href="/admin/profile" className="text-indigo-600 hover:text-indigo-700 transition-colors">
            {userName}
          </Link>{" "}
          <span className="text-xs text-slate-400">({userRole})</span>
        </span>
        <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
