import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Seule la navigation est observée : le cadre, le sélecteur et la cloche (clients, hooks Next) sont neutralisés.
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    sidebarHeader,
    sidebar,
    sidebarFooter,
    children,
  }: {
    sidebarHeader: React.ReactNode;
    sidebar: React.ReactNode;
    sidebarFooter: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {sidebarHeader}
      {sidebar}
      {sidebarFooter}
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
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: ({ className }: { className?: string }) => <i data-c={className} />,
}));
vi.mock("@/components/layout/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { OrgShell } from "../OrgShell";
import { SIDEBAR_LINK } from "@/components/layout/sidebar-classes";
import { systemRolePermissions } from "@/lib/permissions";

function nav(role: "OWNER" | "MANAGER" | "AUDITOR" | "AGENT"): string {
  return renderToStaticMarkup(
    <OrgShell
      org={{ id: "o1", name: "Org", slug: "org" }}
      user={{ name: "U", email: "u@x.test", isStaff: false }}
      orgs={[]}
      permissions={[...systemRolePermissions(role)]}
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

const labels = (html: string) => [...html.matchAll(/<a href="\/org\/o1[^"]*">([^<]+)<\/a>/g)].map((m) => m[1]);

describe("OrgShell : entrées par permission", () => {
  it("OWNER voit Rôles, vers /org/o1/roles ; MANAGER non", () => {
    expect(nav("OWNER")).toContain('<a href="/org/o1/roles">Rôles</a>');
    expect(nav("MANAGER")).not.toContain("/org/o1/roles");
  });

  it("AUDITOR : aucune entrée d'écriture (ni Paramètres, ni Rôles)", () => {
    const l = labels(nav("AUDITOR"));
    expect(l).not.toContain("Paramètres");
    expect(l).not.toContain("Rôles");
    expect(l).toEqual(expect.arrayContaining(["Tableau de bord", "Événements", "Journal"]));
  });

  it("AGENT : tableau de bord, notifications, évènements et documentation seulement", () => {
    expect(labels(nav("AGENT"))).toEqual(["Tableau de bord", "Notifications", "Événements", "Documentation"]);
  });
});

describe("OrgShell : menu clair", () => {
  const html = nav("OWNER");

  it("marque et nom de l'organisation en marine", () => {
    expect(html).toMatch(/<div class="[^"]*text-navy[^"]*">Badge<\/div>/);
    expect(html).toMatch(/<div class="[^"]*text-navy[^"]*">Org<\/div>/);
    expect(html).not.toContain("text-white");
  });

  it("e-mail en gris bleu, déconnexion avec la classe de lien", () => {
    expect(html).toMatch(/text-nav-muted[^"]*">u@x\.test</);
    expect(html).toContain(`data-c="w-full ${SIDEBAR_LINK}"`);
  });
});
