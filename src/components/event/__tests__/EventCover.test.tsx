import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCover, eventCoverUrl } from "../EventCover";

describe("eventCoverUrl", () => {
  it("construit l'URL de fichier à partir de la clé", () => {
    expect(eventCoverUrl("orgs/o1/images/a.png")).toBe("/api/files/orgs/o1/images/a.png");
  });

  it("renvoie null pour une clé absente ou vide", () => {
    expect(eventCoverUrl(null)).toBeNull();
    expect(eventCoverUrl(undefined)).toBeNull();
    expect(eventCoverUrl("")).toBeNull();
  });
});

describe("EventCover", () => {
  it("ne rend rien sans bannière", () => {
    expect(renderToStaticMarkup(<EventCover bannerUrl={null} title="X" variant="hero" />)).toBe("");
    expect(renderToStaticMarkup(<EventCover bannerUrl="" title="X" variant="hero" />)).toBe("");
  });

  it("rend la variante hero 3:1 avec fond neutre et image recadrée", () => {
    const html = renderToStaticMarkup(
      <EventCover bannerUrl="/api/files/k.png" title="Forum 2026" variant="hero" />,
    );
    for (const s of [
      'src="/api/files/k.png"',
      'alt="Forum 2026"',
      "aspect-[3/1]",
      "max-h-72",
      "object-cover",
      "overflow-hidden",
      "bg-slate-100",
      "rounded-xl",
    ]) {
      expect(html).toContain(s);
    }
  });

  it("rend la variante thumb 16:9", () => {
    const html = renderToStaticMarkup(
      <EventCover bannerUrl="/api/files/k.png" title="Forum" variant="thumb" />,
    );
    expect(html).toContain("aspect-video");
    expect(html).toContain("object-cover");
    expect(html).toContain("bg-slate-100");
    expect(html).not.toContain("aspect-[3/1]");
  });

  it("échappe les caractères spéciaux du titre dans l'alt", () => {
    const html = renderToStaticMarkup(
      <EventCover bannerUrl="/api/files/k.png" title={'Salon "Tech" & <Co>'} variant="hero" />,
    );
    expect(html).toContain('alt="Salon &quot;Tech&quot; &amp; &lt;Co&gt;"');
  });
});
