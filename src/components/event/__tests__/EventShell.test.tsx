import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    sidebarHeader, sidebar, banner, children,
  }: { sidebarHeader: React.ReactNode; sidebar: React.ReactNode; banner?: React.ReactNode; children: React.ReactNode }) => (
    <div>{banner}{sidebarHeader}{sidebar}{children}</div>
  ),
}));
vi.mock("@/components/admin/SidebarNav", () => ({
  SidebarNav: ({ items }: { items: Array<{ href?: string; label?: string; group?: string; count?: number }> }) => (
    <ul>
      {items.map((i, n) =>
        i.group ? (
          <li key={n} data-group>{i.group}</li>
        ) : (
          <li key={i.href}><a href={i.href}>{i.label}</a>{i.count ? <b>{i.count}</b> : null}</li>
        ),
      )}
    </ul>
  ),
}));
vi.mock("@/components/layout/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/page-docs/PageDocButton", () => ({ PageDocButton: () => null }));

import { EventShell } from "../EventShell";
import { systemRolePermissions } from "@/lib/permissions";

const event = { id: "e1", title: "Salon", slug: "salon", date: new Date("2026-10-01"), archived: false, registrationOpen: true };

function render(role: "ADMIN" | "PRINTER" | "VIEWER", over: { isStaffMode?: boolean; printUnread?: number; orgLinkEnabled?: boolean } = {}) {
  return renderToStaticMarkup(
    <EventShell
      org={{ id: "o1", name: "Acme" }}
      event={event}
      permissions={[...systemRolePermissions(role)]}
      isStaffMode={over.isStaffMode ?? false}
      printUnread={over.printUnread}
      orgLinkEnabled={over.orgLinkEnabled}
      user={{ name: "U", email: "u@x.test" }}
    >
      contenu
    </EventShell>,
  );
}
const labels = (html: string) => [...html.matchAll(/<a href="\/event\/e1[^"]*">([^<]+)<\/a>/g)].map((m) => m[1]);

describe("EventShell", () => {
  it("ADMIN : entrées complètes et groupe Administration, sans pastille de rôle", () => {
    const html = render("ADMIN");
    expect(labels(html)).toEqual([
      "Tableau de bord", "Notifications", "Inscriptions", "Badges", "Impression", "Poste sur place", "Catégories",
      "Scanner", "Membres", "Documentation", "Paramètres", "Journal",
    ]);
    expect(html).toContain("data-group");
    expect(html).not.toContain("ADMIN</span>");
  });

  it("PRINTER : Notifications et Badges seulement, pas de groupe Administration", () => {
    const html = render("PRINTER");
    expect(labels(html)).toEqual(["Notifications", "Badges", "Documentation"]);
    expect(html).not.toContain("data-group");
  });

  it("VIEWER : tableau de bord, notifications, vue d'ensemble", () => {
    expect(labels(render("VIEWER"))).toEqual(["Tableau de bord", "Notifications", "Vue d&#x27;ensemble", "Documentation"]);
  });

  it("compteur sur Impression", () => {
    expect(render("ADMIN", { printUnread: 4 })).toContain("<b>4</b>");
    expect(render("ADMIN")).not.toContain("<b>");
  });

  it("bandeau Mode staff seulement en mode staff", () => {
    expect(render("ADMIN", { isStaffMode: true })).toContain("Mode staff");
    expect(render("ADMIN")).not.toContain("Mode staff");
  });

  it("lien de retour vers l'organisation, ou simple libellé sans espace d'organisation", () => {
    expect(render("ADMIN")).toContain('href="/org/o1/events"');
    const plain = render("PRINTER", { orgLinkEnabled: false });
    expect(plain).not.toContain("/org/o1/events");
    expect(plain).toContain("Acme");
  });
});
