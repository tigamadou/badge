import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordMeter } from "../PasswordMeter";

describe("PasswordMeter", () => {
  it("allume `score` barres", () => {
    const html = renderToStaticMarkup(<PasswordMeter score={3} />);
    expect((html.match(/data-on="true"/g) || []).length).toBe(3);
    expect((html.match(/data-on="false"/g) || []).length).toBe(1);
  });

  it("aucune barre allumee a 0", () => {
    const html = renderToStaticMarkup(<PasswordMeter score={0} />);
    expect(html).not.toContain('data-on="true"');
  });
});
