import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderSteps } from "../OrderSteps";

describe("OrderSteps", () => {
  it("marque l'étape courante et laisse les suivantes à venir", () => {
    const html = renderToStaticMarkup(<OrderSteps status="PAID" type="ADVANCE" />);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[^>]*data-state="current"[^>]*>.*?Payée/);
    expect(html.match(/data-state="todo"/g)).toHaveLength(3);
    expect(html.match(/data-state="done"/g)).toHaveLength(3);
  });

  it("une commande refusée s'arrête à son étape", () => {
    const html = renderToStaticMarkup(<OrderSteps status="REJECTED" type="ADVANCE" />);
    expect(html).toContain('data-state="stopped"');
    expect(html).not.toContain('data-state="todo"');
  });
});
