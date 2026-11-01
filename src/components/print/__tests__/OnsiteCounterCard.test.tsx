import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { computeOnsiteCounter } from "@/lib/print-requests/onsite-counter";
import { OnsiteCounterCard } from "../OnsiteCounterCard";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
const render = (printed: number, ordered: number, marginPercent: number) =>
  renderToStaticMarkup(<OnsiteCounterCard counter={computeOnsiteCounter({ ordered, marginPercent, printed })} />);

describe("OnsiteCounterCard", () => {
  it("NORMAL (179/200) : compteur et barre, aucune alerte", () => {
    const html = render(179, 200, 10);
    expect(html).toContain("179 / 200 badges imprimés");
    expect(html).toContain('width:89.5%');
    expect(html).not.toContain('role="alert"');
  });

  it("WARNING (180/200) : 90 % de la commande atteinte", () => {
    const html = render(180, 200, 10);
    expect(html).toContain("180 / 200 badges imprimés");
    expect(html).toContain(esc("90 % de la commande atteinte"));
    expect(html).toContain('role="alert"');
  });

  it("OVER (212/200) : badges au-delà de la commande, barre pleine", () => {
    const html = render(212, 200, 10);
    expect(html).toContain("212 / 200 badges imprimés");
    expect(html).toContain(esc("12 badges au-delà de la commande, facturés après l'évènement"));
    expect(html).toContain("width:100%");
  });

  it("OVER au singulier (201/200)", () => {
    expect(render(201, 200, 10)).toContain(esc("1 badge au-delà de la commande, facturé après l'évènement"));
  });

  it("CAP_REACHED (220/200) : impression bloquée", () => {
    const html = render(220, 200, 10);
    expect(html).toContain(esc("Plafond atteint (220) : l'impression est bloquée"));
  });

  it("commande vide : pas de division par zéro", () => {
    expect(render(0, 0, 0)).toContain("width:0%");
  });
});
