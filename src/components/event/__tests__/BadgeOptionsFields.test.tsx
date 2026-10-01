import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgeOptionsFields } from "../BadgeOptionsFields";

const noop = () => {};
const upload = async () => null;

describe("BadgeOptionsFields", () => {
  it("rend un champ par type avec le libelle du manifeste", () => {
    const html = renderToStaticMarkup(
      <BadgeOptionsFields
        options={[
          { name: "showColorBar", kind: "boolean", label: "Bandeau tricolore", sample: true },
          { name: "zone", kind: "text", label: "Zone" },
          { name: "teinte", kind: "color", label: "Teinte" },
          { name: "jour", kind: "date", label: "Jour" },
          { name: "lignes", kind: "list", label: "Lignes" },
          { name: "visuel", kind: "image", label: "Visuel" },
        ]}
        values={{ showColorBar: true, zone: "C" }}
        onChange={noop}
        onUpload={upload}
      />,
    );
    expect(html).toContain("Bandeau tricolore");
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain('value="C"');
    expect(html).toContain('type="color"');
    expect(html).toContain('type="date"');
    expect(html).toContain("<textarea");
    expect(html).toContain("Déposer une image ou cliquer");
  });

  it("signale les champs non booleens non regles", () => {
    const html = renderToStaticMarkup(
      <BadgeOptionsFields options={[{ name: "zone", kind: "text", label: "Zone" }]} values={{}} onChange={noop} onUpload={upload} />,
    );
    expect(html).toContain("À renseigner");
  });

  it("montre l'image reglee avec un bouton Retirer et le contenu de la liste", () => {
    const html = renderToStaticMarkup(
      <BadgeOptionsFields
        options={[
          { name: "visuel", kind: "image", label: "Visuel" },
          { name: "lignes", kind: "list", label: "Lignes" },
        ]}
        values={{ visuel: "uploads/a.png", lignes: ["un", "deux"] }}
        onChange={noop}
        onUpload={upload}
      />,
    );
    expect(html).toContain("/api/files/uploads/a.png");
    expect(html).toContain("Retirer");
    expect(html).not.toContain("À renseigner");
    expect(html).toContain("un\ndeux");
  });

  it("ne rend rien sans option", () => {
    expect(renderToStaticMarkup(<BadgeOptionsFields options={[]} values={{}} onChange={noop} onUpload={upload} />)).toBe("");
  });
});
