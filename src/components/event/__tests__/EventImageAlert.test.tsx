import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventImageAlert } from "../EventImageAlert";

describe("EventImageAlert", () => {
  it("ne rend rien sans problème", () => {
    expect(renderToStaticMarkup(<EventImageAlert eventId="e1" issues={[]} />)).toBe("");
  });

  it("liste chaque image, son message et le lien vers les paramètres", () => {
    const html = renderToStaticMarkup(
      <EventImageAlert
        eventId="e1"
        issues={[
          { slot: "logo", message: "Ratio attendu 1:1, par ex. 136 × 136 px." },
          { slot: "banner", message: "Ratio attendu 3:1, par ex. 1500 × 500 px." },
        ]}
      />,
    );
    expect(html).toContain("Images à recadrer");
    expect(html).toContain("logo");
    expect(html).toContain("bannière");
    expect(html).toContain("Ratio attendu 1:1");
    expect(html).toContain("Ratio attendu 3:1");
    expect(html).toContain('href="/event/e1/settings"');
    expect(html).toContain("bloquée");
  });
});
