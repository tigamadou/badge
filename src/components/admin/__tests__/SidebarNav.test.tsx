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
});
