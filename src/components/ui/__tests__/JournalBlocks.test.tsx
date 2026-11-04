import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LogType, KeyValue, Diff, Payload } from "../JournalBlocks";

describe("JournalBlocks", () => {
  it("LogType rend son libelle et sa couleur de categorie", () => {
    const html = renderToStaticMarkup(<LogType kind="modification">Modification</LogType>);
    expect(html).toContain("Modification");
    expect(html).toContain("bg-mist text-navy");
  });

  it.each([
    ["creation", "bg-turquoise-soft text-turquoise-strong"],
    ["systeme", "bg-gold-soft text-gold-strong"],
    ["acces", "bg-navy/10 text-navy"],
    ["connexion", "bg-slate-100 text-slate-600"],
    ["suppression", "bg-rose-50 text-rose-700"],
  ] as const)("LogType %s", (kind, classes) => {
    expect(renderToStaticMarkup(<LogType kind={kind}>X</LogType>)).toContain(classes);
  });

  it("KeyValue rend chaque paire", () => {
    const html = renderToStaticMarkup(<KeyValue items={[{ label: "Auteur", value: "Marie Dubois" }]} />);
    expect(html).toContain("Auteur");
    expect(html).toContain("Marie Dubois");
  });

  it("Diff rend avant/apres", () => {
    const html = renderToStaticMarkup(<Diff oldValue="Presse" newValue="Presse (anonyme)" />);
    expect(html).toContain("Presse");
    expect(html).toContain("Presse (anonyme)");
    expect(html).toContain("border-turquoise/30 bg-turquoise-soft");
  });

  it("Payload rend le JSON", () => {
    expect(renderToStaticMarkup(<Payload json='{"a":1}' />)).toContain('{&quot;a&quot;:1}');
  });
});
