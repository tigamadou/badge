import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicEventLayout } from "../PublicEventLayout";

const base = { title: "Forum 2026", date: new Date("2026-11-01"), location: "Dakar", logo: null };

function render(event: Parameters<typeof PublicEventLayout>[0]["event"]) {
  return renderToStaticMarkup(
    <PublicEventLayout event={event}>
      <p>ENFANT</p>
    </PublicEventLayout>,
  );
}

describe("PublicEventLayout — cover", () => {
  it("affiche la cover avant le contenu quand une bannière existe", () => {
    const html = render({ ...base, banner: "orgs/o1/images/c.png" });
    expect(html).toContain('src="/api/files/orgs/o1/images/c.png"');
    expect(html).toContain("aspect-[3/1]");
    expect(html.indexOf("/api/files/")).toBeLessThan(html.indexOf("ENFANT"));
  });

  it.each([[undefined], [null]])("n'affiche aucune cover sans bannière (%s)", (banner) => {
    const html = render({ ...base, banner });
    expect(html).not.toContain("aspect-[3/1]");
    expect(html).not.toContain("/api/files/");
    expect(html).toContain("ENFANT");
    expect(html).toContain("Forum 2026");
  });
});
