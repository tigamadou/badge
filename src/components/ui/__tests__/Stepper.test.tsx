import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Stepper } from "../Stepper";

describe("Stepper", () => {
  it("marque done / on / todo selon current", () => {
    const html = renderToStaticMarkup(<Stepper steps={["Informations", "Categories", "Recapitulatif"]} current={1} />);
    expect(html).toContain("Informations");
    expect(html).toContain("Categories");
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-state="on"');
    expect(html).toContain('data-state="todo"');
  });
});
