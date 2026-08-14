import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgeCard } from "../BadgeCard";
import { MiniBadge } from "../MiniBadge";

describe("BadgeCard / MiniBadge", () => {
  it("BadgeCard affiche nom, org, categorie et bandeau all-access", () => {
    const html = renderToStaticMarkup(
      <BadgeCard
        org="Salon Tech"
        name="Yanis Bernard"
        category="EXPOSANT"
        categoryColor="#16a34a"
        qr={<svg />}
        meta="ID 4821"
        allAccess
      />,
    );
    expect(html).toContain("Yanis Bernard");
    expect(html).toContain("Salon Tech");
    expect(html).toContain("EXPOSANT");
    expect(html).toContain("ALL ACCESS");
    expect(html).toContain("font-badge");
  });

  it("MiniBadge reflete l'etat done", () => {
    const html = renderToStaticMarkup(
      <MiniBadge name="A. Dupont" category="Visiteur" categoryColor="#2563eb" state="done" />,
    );
    expect(html).toContain("A. Dupont");
    expect(html).toContain("bg-green-600");
  });
});
