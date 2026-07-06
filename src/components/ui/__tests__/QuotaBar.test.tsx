import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuotaBar, StorageAlert } from "../QuotaBar";

describe("QuotaBar", () => {
  it("clampe la largeur a 100 et expose la valeur", () => {
    const html = renderToStaticMarkup(<QuotaBar label="Stockage" valueText="18,4 / 200 Go" pct={120} />);
    expect(html).toContain("Stockage");
    expect(html).toContain("18,4 / 200 Go");
    expect(html).toContain("width:100%");
  });

  it("colore la barre selon les seuils", () => {
    expect(renderToStaticMarkup(<QuotaBar label="a" valueText="b" pct={50} />)).toContain("bg-green-600");
    expect(renderToStaticMarkup(<QuotaBar label="a" valueText="b" pct={80} />)).toContain("bg-amber-700");
    expect(renderToStaticMarkup(<QuotaBar label="a" valueText="b" pct={95} />)).toContain("bg-rose-600");
  });

  it("StorageAlert masque sous 75% et s'affiche au-dela", () => {
    expect(renderToStaticMarkup(<StorageAlert pct={50}>x</StorageAlert>)).toBe("");
    expect(renderToStaticMarkup(<StorageAlert pct={82}>Quota bientot atteint</StorageAlert>)).toContain(
      "Quota bientot atteint",
    );
  });
});
