import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {sidebar}
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
vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));
vi.mock("@/components/layout/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { StaffShell } from "../StaffShell";

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
