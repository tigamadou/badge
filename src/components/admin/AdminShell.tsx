"use client";

import { useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";

interface AdminShellProps {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

export function AdminShell({ userName, userRole, children }: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userRole={userRole}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          userName={userName}
          userRole={userRole}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
