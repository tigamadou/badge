import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

// usePathname() hors contexte Next renvoie null : on le simule (ruling C9).
vi.mock("next/navigation", () => ({ usePathname: () => "/platform" }));

import { SidebarNav, type NavEntry } from "../SidebarNav";

const link = (count?: number): NavEntry[] => [
  { href: "/platform/print/orders", label: "Commandes", icon: "inbox", count },
];

describe("SidebarNav", () => {
  it("affiche une pastille avec le compteur et un libellé accessible", () => {
    const html = renderToString(<SidebarNav items={link(3)} />);
    expect(html).toContain("Commandes");
    expect(html).toContain('aria-label="3 en attente"');
    expect(html).toMatch(/aria-label="3 en attente"[^>]*>3</);
  });

  it("n'affiche pas de pastille à zéro", () => {
    expect(renderToString(<SidebarNav items={link(0)} />)).not.toContain("en attente");
  });

  it("n'affiche pas de pastille sans compteur", () => {
    expect(renderToString(<SidebarNav items={link()} />)).not.toContain("en attente");
  });

  it("rend les groupes et marque le lien actif", () => {
    const html = renderToString(
      <SidebarNav
        items={[
          { group: "Impression" },
          { href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true },
        ]}
      />,
    );
    expect(html).toContain("Impression");
    expect(html).toContain('aria-current="page"');
  });

  it("lien inactif : gris bleu, survol mist", () => {
    const html = renderToString(
      <SidebarNav items={[{ href: "/platform/users", label: "Utilisateurs", icon: "users" }]} />,
    );
    expect(html).toContain("text-nav-muted");
    expect(html).toContain("hover:bg-mist");
  });

  it("lien actif : trait or, fond mist, texte marine", () => {
    const html = renderToString(
      <SidebarNav
        items={[{ href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true }]}
      />,
    );
    expect(html).toContain("border-gold bg-mist");
    expect(html).toContain("font-medium text-navy");
  });

  it("intitulé de groupe et pastille de compteur", () => {
    const html = renderToString(
      <SidebarNav items={[{ group: "Impression" }, ...link(2)]} />,
    );
    expect(html).toMatch(/text-nav-muted">Impression</);
    expect(html).toContain("bg-rose-600");
    expect(html).toContain("text-white");
  });

  it("aucune ancienne classe sombre", () => {
    const html = renderToString(
      <SidebarNav
        items={[
          { group: "Impression" },
          { href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true },
          ...link(2),
        ]}
      />,
    );
    for (const banned of ["text-white/45", "green-", "slate-300", "bg-white/10"]) {
      expect(html).not.toContain(banned);
    }
  });
});
