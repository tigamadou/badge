"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  userName: string;
  userRole: string;
}

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b px-6 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {userName} <span className="text-xs text-gray-400">({userRole})</span>
        </span>
        <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
