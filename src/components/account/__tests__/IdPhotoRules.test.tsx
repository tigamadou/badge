import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ID_PHOTO_RULES, IdPhotoRules } from "../IdPhotoRules";

describe("IdPhotoRules", () => {
  it("affiche les six règles et le format 7:9", () => {
    const html = renderToStaticMarkup(<IdPhotoRules />);
    expect(ID_PHOTO_RULES).toHaveLength(6);
    for (const rule of ID_PHOTO_RULES) expect(html).toContain(rule.replace("'", "&#x27;"));
    expect(html).toContain("7:9");
    expect(html).toContain("35 × 45 mm");
    expect(html).toContain("210 × 270 px");
  });
});
