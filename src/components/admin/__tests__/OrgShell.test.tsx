import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Seule la navigation est observée : le cadre, le sélecteur et la cloche (clients, hooks Next) sont neutralisés.
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {sidebar}
      {children}
    </div>
  ),
}));
vi.mock("../SidebarNav", () => ({
  SidebarNav: ({ items }: { items: { href: string; label: string }[] }) => (
    <ul>
      {items.map((i) => (
        <li key={i.href}>
          <a href={i.href}>{i.label}</a>
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("../OrgSelector", () => ({ OrgSelector: () => null }));
vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));
vi.mock("@/components/layout/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { OrgShell } from "../OrgShell";

function nav(role: "OWNER" | "MANAGER" | "AUDITOR"): string {
  return renderToStaticMarkup(
    <OrgShell
      org={{ id: "o1", name: "Org", slug: "org" }}
      user={{ name: "U", email: "u@x.test", isStaff: false }}
      orgs={[]}
      orgRole={role}
    >
      contenu
    </OrgShell>,
  );
}

describe("OrgShell : entrée Paiements", () => {
  it("visible pour MANAGER et OWNER, après Abonnement", () => {
    for (const role of ["MANAGER", "OWNER"] as const) {
      const html = nav(role);
      expect(html).toContain('<a href="/org/o1/payments">Paiements</a>');
      expect(html.indexOf("/org/o1/subscription")).toBeLessThan(html.indexOf("/org/o1/payments"));
    }
  });

  it("absente pour AUDITOR", () => {
    const html = nav("AUDITOR");
    expect(html).not.toContain("/org/o1/payments");
    expect(html).not.toContain("/org/o1/subscription");
  });
});
