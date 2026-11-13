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

import { StaffShell, buildStaffNav } from "../StaffShell";
import { systemRolePermissions, type Permission } from "@/lib/permissions";
import { SIDEBAR_LINK } from "@/components/layout/sidebar-classes";

type RoleKey = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_PRINTER" | "STAFF_OBSERVER";

function shell(role: RoleKey, roleName = role) {
  return renderToStaticMarkup(
    <StaffShell user={{ name: "S", email: "s@x.test", roleName }} permissions={systemRolePermissions(role)} pendingPrintRequests={0}>
      x
    </StaffShell>,
  );
}

function hrefs(html: string) {
  return [...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]);
}

describe("StaffShell : menu filtré par permission", () => {
  it("l'Imprimeur voit le tableau de bord, les notifications, la documentation et Impression, rien d'autre", () => {
    const html = shell("STAFF_PRINTER");
    expect(hrefs(html)).toEqual([
      "/platform",
      "/platform/notifications",
      "/platform/docs",
      "/platform/print/orders",
      "/platform/print/sheets",
      "/platform/print/layouts",
      "/platform/print/catalog",
    ]);
  });

  it("l'Observateur n'a pas l'entrée Planches mais voit Paiements après Plans", () => {
    const html = shell("STAFF_OBSERVER");
    expect(html).not.toContain("/platform/print/sheets");
    expect(html).toContain('<a href="/platform/payments">Paiements</a>');
    expect(html.indexOf("/platform/plans")).toBeLessThan(html.indexOf("/platform/payments"));
  });

  it("le Support n'a ni Planches, ni Gabarits, ni Catalogue, ni Commandes", () => {
    const list = hrefs(shell("STAFF_SUPPORT"));
    expect(list.filter((h) => h.startsWith("/platform/print"))).toEqual([]);
    expect(list).toContain("/platform/profiles");
  });

  it("seul le Super admin voit « Rôles », placé après Journal", () => {
    for (const role of ["STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_PRINTER", "STAFF_OBSERVER"] as const) {
      expect(hrefs(shell(role))).not.toContain("/platform/roles");
    }
    const sa = hrefs(shell("SUPER_ADMIN"));
    expect(sa).toContain("/platform/roles");
    expect(sa.indexOf("/platform/roles")).toBeGreaterThan(sa.indexOf("/platform/activity"));
  });

  it("le Staff admin voit toutes les entrées sauf Rôles", () => {
    const list = hrefs(shell("STAFF_ADMIN"));
    for (const h of ["/platform/organizations", "/platform/settings", "/platform/jobs", "/platform/activity", "/platform/users"]) {
      expect(list).toContain(h);
    }
  });

  it("n'affiche pas le groupe Plateforme quand aucune de ses entrées n'est visible", () => {
    const perms = new Set<Permission>(["platform.access", "print.requests.read"]);
    const html = renderToStaticMarkup(
      <StaffShell user={{ name: "S", email: "s@x.test", roleName: "X" }} permissions={perms} pendingPrintRequests={0}>
        x
      </StaffShell>,
    );
    expect(hrefs(html)).not.toContain("/platform/settings");
    expect(hrefs(html)).toContain("/platform/print/orders");
  });

  it("le libellé du rôle affiché est roleName", () => {
    const html = shell("STAFF_PRINTER", "Imprimeur" as never);
    expect(html).toContain(">Imprimeur<");
  });
});

describe("buildStaffNav", () => {
  it("regroupe sous « Impression » et « Plateforme » seulement quand une entrée est visible", () => {
    const groups = (role: RoleKey) =>
      buildStaffNav(systemRolePermissions(role), 0).flatMap((e) => ("group" in e ? [e.group] : []));
    expect(groups("STAFF_PRINTER")).toEqual(["Impression"]);
    expect(groups("STAFF_OBSERVER")).toEqual(["Impression", "Plateforme"]);
    expect(groups("STAFF_SUPPORT")).toEqual(["Plateforme"]);
  });

  it("porte le compteur de commandes en attente", () => {
    const orders = buildStaffNav(systemRolePermissions("STAFF_ADMIN"), 4).find(
      (e) => "href" in e && e.href === "/platform/print/orders",
    );
    expect(orders).toMatchObject({ count: 4 });
  });
});

describe("StaffShell : palette claire", () => {
  const html = renderToStaticMarkup(
    <StaffShell
      user={{ name: "S", email: "s@x.test", roleName: "Administrateur" }}
      permissions={systemRolePermissions("STAFF_ADMIN")}
      pendingPrintRequests={0}
    >
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
