import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FullHeightPage } from "../FullHeightPage";
import { AppShell } from "../AppShell";

describe("FullHeightPage", () => {
  it("remplit la zone de contenu", () => {
    const html = renderToStaticMarkup(<FullHeightPage><p>Page</p></FullHeightPage>);
    expect(html).toContain("absolute inset-0");
    expect(html).toContain("<p>Page</p>");
  });

  it("AppShell positionne <main> pour la contenir", () => {
    const html = renderToStaticMarkup(
      <AppShell sidebar={<nav />} header={<span />}><p>x</p></AppShell>,
    );
    expect(html).toMatch(/<main[^>]*class="[^"]*\brelative\b/);
  });
});
