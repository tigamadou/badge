import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LogType, KeyValue, Diff, Payload } from "../JournalBlocks";

describe("JournalBlocks", () => {
  it("LogType rend son libelle et sa couleur de categorie", () => {
    const html = renderToStaticMarkup(<LogType kind="modification">Modification</LogType>);
    expect(html).toContain("Modification");
    expect(html).toContain("text-indigo-600");
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
  });

  it("Payload rend le JSON", () => {
    expect(renderToStaticMarkup(<Payload json='{"a":1}' />)).toContain('{&quot;a&quot;:1}');
  });
});
