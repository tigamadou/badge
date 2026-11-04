import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    sidebarHeader,
    sidebar,
    sidebarFooter,
    header,
    children,
  }: {
    sidebarHeader: React.ReactNode;
    sidebar: React.ReactNode;
    sidebarFooter: React.ReactNode;
    header: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {sidebarHeader}
      {sidebar}
      {sidebarFooter}
      {header}
      {children}
    </div>
  ),
}));
vi.mock("@/components/admin/SidebarNav", () => ({
  SidebarNav: ({ items }: { items: ({ href: string; label: string } | { group: string })[] }) => (
    <ul>
      {items.map((i, k) =>
        "href" in i ? (
          <li key={k}>
            <a href={i.href}>{i.label}</a>
          </li>
        ) : null,
      )}
    </ul>
  ),
}));
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: ({ className }: { className?: string }) => <i data-c={className} />,
}));
vi.mock("@/components/layout/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { StaffShell } from "../StaffShell";
import { SIDEBAR_LINK } from "@/components/layout/sidebar-classes";

describe("StaffShell : entrée Paiements", () => {
  it("visible pour tout rôle staff, après Plans", () => {
    for (const staffRole of ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"] as const) {
      const html = renderToStaticMarkup(
        <StaffShell user={{ name: "S", email: "s@x.test", staffRole }} pendingPrintRequests={0}>
          x
        </StaffShell>,
      );
      expect(html).toContain('<a href="/platform/payments">Paiements</a>');
      expect(html.indexOf("/platform/plans")).toBeLessThan(html.indexOf("/platform/payments"));
    }
  });
});

describe("StaffShell : palette claire", () => {
  const html = renderToStaticMarkup(
    <StaffShell user={{ name: "S", email: "s@x.test", staffRole: "STAFF_ADMIN" }} pendingPrintRequests={0}>
      x
    </StaffShell>,
  );

  it("marque en marine, plus en blanc", () => {
    expect(html).toMatch(/<div class="[^"]*text-navy[^"]*">Badge<\/div>/);
    expect(html).not.toMatch(/<div class="[^"]*text-white[^"]*">Badge<\/div>/);
  });

  it("badge de rôle de l'en-tête en marine sur fond translucide", () => {
    expect(html).toContain("bg-navy/10");
    expect(html).toContain("text-navy");
    expect(html).not.toContain("brand-navy");
  });

  it("libellé Staff lisible sur fond blanc", () => {
    expect(html).toContain('<span class="truncate text-slate-500">Staff</span>');
  });

  it("la déconnexion reçoit la classe de lien du menu", () => {
    expect(html).toContain(`data-c="w-full ${SIDEBAR_LINK}"`);
  });
});
