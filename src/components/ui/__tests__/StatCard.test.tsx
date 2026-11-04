import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCard, StatGrid } from "../StatCard";

describe("StatCard", () => {
  it("affiche label, valeur, sous-texte et delta up", () => {
    const html = renderToStaticMarkup(
      <StatGrid cols={4}>
        <StatCard label="Organisations" value="24" icon="building-2" sub="ce mois" delta={{ dir: "up", text: "+2" }} />
      </StatGrid>,
    );
    expect(html).toContain("Organisations");
    expect(html).toContain("24");
    expect(html).toContain("+2");
    expect(html).toContain("ce mois");
    expect(html).toContain("text-turquoise-strong");
  });

  it("puce d'icône marine translucide et liseré or", () => {
    expect(renderToStaticMarkup(<StatCard label="a" value="1" icon="user-check" />)).toContain("bg-navy/10");
  });

  it("delta down en rose", () => {
    const html = renderToStaticMarkup(
      <StatCard label="Rejetees" value="3" icon="user-check" delta={{ dir: "down", text: "-1" }} />,
    );
    expect(html).toContain("text-rose-700");
  });

  it("StatGrid applique le nombre de colonnes", () => {
    const html = renderToStaticMarkup(
      <StatGrid cols={5}>
        <span>x</span>
      </StatGrid>,
    );
    expect(html).toContain("lg:grid-cols-5");
  });
});
