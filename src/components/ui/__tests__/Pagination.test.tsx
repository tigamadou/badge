import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Mock de navigation (hors base) : UrlPagination lit l'URL courante.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/org/o1/events",
  useSearchParams: () => new URLSearchParams("q=a&page=2"),
}));

import { Pagination, UrlPagination } from "@/components/ui/Pagination";

const noop = () => {};
const base = { page: 1, totalPages: 10, total: 95, pageSize: 10, onPageChange: noop, onPageSizeChange: noop };

describe("Pagination", () => {
  it("ne rend rien sans resultat", () => {
    expect(renderToStaticMarkup(<Pagination {...base} total={0} />)).toBe("");
  });

  it("propose 10/20/50/100/500 par defaut", () => {
    const html = renderToStaticMarkup(<Pagination {...base} />);
    for (const n of [10, 20, 50, 100, 500]) expect(html).toContain(`${n} par page`);
    expect(html).not.toContain("30 par page");
  });

  it("respecte pageSizeOptions explicite", () => {
    const html = renderToStaticMarkup(<Pagination {...base} pageSizeOptions={[50, 100]} />);
    expect(html).toContain("50 par page");
    expect(html).toContain("100 par page");
    expect(html).not.toContain("10 par page");
    expect(html).not.toContain("500 par page");
  });

  it("palette : page courante marine, focus marine, survol mist", () => {
    const html = renderToStaticMarkup(<Pagination {...base} />);
    expect(html).toContain("bg-navy text-white");
    expect(html).toContain("ring-navy");
    expect(html).toContain("hover:bg-mist");
    expect(html).not.toContain("green-");
  });

  it("page 1 : precedent desactive, page courante marquee, total", () => {
    const html = renderToStaticMarkup(<Pagination {...base} />);
    expect(html).toMatch(/aria-current="page"[^>]*>1</);
    expect(html).toMatch(/disabled=""[^>]*aria-label="Page précédente"|aria-label="Page précédente"[^>]*disabled=""/);
    expect(html).toContain("95 résultats");
  });
});

describe("UrlPagination", () => {
  const props = { page: 1, totalPages: 10, total: 95, pageSize: 10 };
  it("ne rend rien sans resultat", () => {
    expect(renderToStaticMarkup(<UrlPagination {...props} total={0} />)).toBe("");
  });
  it("rend les options 10/20/50/100/500", () => {
    const html = renderToStaticMarkup(<UrlPagination {...props} />);
    for (const n of [10, 20, 50, 100, 500]) expect(html).toContain(`${n} par page`);
  });
});
