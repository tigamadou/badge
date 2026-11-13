import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlatformDocsPage from "@/app/platform/docs/page";
import OrgDocsPage from "@/app/org/[orgId]/docs/page";
import EventDocsPage from "@/app/event/[eventId]/docs/page";
import AccountDocsPage from "@/app/account/docs/page";

describe("pages d'attente de la documentation", () => {
  const cases: [string, () => Promise<React.ReactElement> | React.ReactElement][] = [
    ["platform", () => PlatformDocsPage()],
    ["org", () => OrgDocsPage({ params: Promise.resolve({ orgId: "o1" }) })],
    ["event", () => EventDocsPage({ params: Promise.resolve({ eventId: "e1" }) })],
    ["account", () => AccountDocsPage()],
  ];

  it.each(cases)("%s : titre Documentation et Bientôt disponible", async (_n, render) => {
    const html = renderToStaticMarkup(await render());
    expect(html).toContain(">Documentation<");
    expect(html).toContain("Bientôt disponible");
    expect(html).toContain("La documentation de cet espace arrive prochainement.");
  });
});
