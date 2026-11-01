import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import { OrgAccessGate } from "../OrgAccessGate";

function render(canAccessOrgSpace: boolean, pathname: string) {
  pathnameMock.mockReturnValue(pathname);
  return renderToStaticMarkup(
    <OrgAccessGate orgId="o1" canAccessOrgSpace={canAccessOrgSpace}>
      <p>contenu-page</p>
    </OrgAccessGate>,
  );
}

describe("OrgAccessGate", () => {
  beforeEach(() => pathnameMock.mockReset());

  it("accès accordé : affiche le contenu", () => {
    const html = render(true, "/org/o1/members");
    expect(html).toContain("contenu-page");
    expect(html).not.toContain("Abonnement inactif");
  });

  it("accès refusé sur /members : écran bloquant", () => {
    const html = render(false, "/org/o1/members");
    expect(html).toContain("Abonnement inactif");
    expect(html).not.toContain("contenu-page");
  });

  it("accès refusé sur /events : contenu", () => {
    const html = render(false, "/org/o1/events");
    expect(html).toContain("contenu-page");
    expect(html).not.toContain("Abonnement inactif");
  });

  it("accès refusé sur /subscription/return : contenu", () => {
    const html = render(false, "/org/o1/subscription/return");
    expect(html).toContain("contenu-page");
    expect(html).not.toContain("Abonnement inactif");
  });

  it("accès refusé sur /events/new : contenu (la page redirige elle-même)", () => {
    const html = render(false, "/org/o1/events/new");
    expect(html).toContain("contenu-page");
    expect(html).not.toContain("Abonnement inactif");
  });
});
