import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OnsiteTemplateAlert } from "../OnsiteTemplateAlert";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("OnsiteTemplateAlert", () => {
  it("staff : message de blocage, sans lien", () => {
    const html = renderToStaticMarkup(<OnsiteTemplateAlert side="STAFF" eventId="e1" />);
    expect(html).toContain(
      esc("Template non adapté : l'avancement est bloqué jusqu'au retour à un template adapté."),
    );
    expect(html).not.toContain("<a");
  });

  it("organisateur : message et lien vers le réglage du template", () => {
    const html = renderToStaticMarkup(<OnsiteTemplateAlert side="ORGANIZER" eventId="e1" />);
    expect(html).toContain(
      esc("Le modèle de badge choisi n'est pas adapté à l'impression sur place. L'équipe Badge ne peut pas avancer cette commande."),
    );
    expect(html).toContain('href="/event/e1/settings/badge"');
  });
});
