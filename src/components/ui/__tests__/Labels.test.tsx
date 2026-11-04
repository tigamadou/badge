import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CatPill, RoleBadge, Tag } from "../Labels";

describe("Labels", () => {
  it("CatPill rend couleur, libelle et compteur", () => {
    const html = renderToStaticMarkup(<CatPill color="#16a34a" label="Exposant" count={128} />);
    expect(html).toContain("Exposant");
    expect(html).toContain("128");
    expect(html).toContain("#16a34a");
  });

  it("RoleBadge navy rend le libelle", () => {
    const html = renderToStaticMarkup(<RoleBadge tone="navy">SUPER_ADMIN</RoleBadge>);
    expect(html).toContain("SUPER_ADMIN");
    expect(html).toContain("bg-navy/10");
    expect(html).toContain("text-navy");
  });

  it.each([
    ["green", "bg-turquoise-soft text-turquoise-strong"],
    ["amber", "bg-gold-soft text-gold-strong"],
    ["warn", "bg-warn-soft text-warn"],
    ["slate", "bg-mist text-slate-600"],
  ] as const)("RoleBadge %s", (tone, classes) => {
    expect(renderToStaticMarkup(<RoleBadge tone={tone}>X</RoleBadge>)).toContain(classes);
  });

  it("Tag rend son contenu", () => {
    expect(renderToStaticMarkup(<Tag icon="check">actif</Tag>)).toContain("actif");
  });
});
