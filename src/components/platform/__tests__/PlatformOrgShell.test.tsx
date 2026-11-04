import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform/organizations/o1/members",
}));

import { PlatformOrgShell } from "../PlatformOrgShell";

describe("PlatformOrgShell", () => {
  const html = renderToStaticMarkup(
    <PlatformOrgShell org={{ id: "o1", name: "Acme" }}>
      <p>x</p>
    </PlatformOrgShell>,
  );

  it("badge de supervision en avertissement orange", () => {
    expect(html).toContain("bg-warn-soft");
    expect(html).toContain("text-warn");
    expect(html).toContain("Supervision — lecture seule");
  });

  it("onglet actif marine, inactif gris", () => {
    expect(html).toMatch(/aria-current="page"[^>]*class="[^"]*border-navy[^"]*text-navy/);
    expect(html).toContain("text-slate-500 hover:text-slate-700");
  });

  it("lien retour lisible", () => {
    expect(html).toContain("text-slate-500 hover:text-navy");
  });

  it("aucune ancienne couleur", () => {
    expect(html).not.toMatch(/amber-|brand-navy/);
  });
});
