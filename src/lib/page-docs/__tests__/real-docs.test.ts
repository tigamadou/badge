import { describe, expect, it } from "vitest";
import { PAGE_DOCS } from "@/content/page-docs/manifest.generated";
import { PAGE_DOC_INDEX } from "@/content/page-docs/index.generated";
import { filterPermissionBlocks, renderDocHtml, summaryOf } from "../index";

// Docs réelles du dépôt : elles se filtrent et se rendent sans erreur, sans marqueur résiduel.
describe("docs réelles", () => {
  it("le manifeste et l'index décrivent les mêmes docs", () => {
    expect(PAGE_DOC_INDEX.map((d) => d.id)).toEqual(PAGE_DOCS.map((d) => d.id));
  });

  it.each(PAGE_DOCS.map((d) => [d.id, d] as const))("%s se rend", (_id, doc) => {
    for (const decision of [true, false, undefined]) {
      const html = renderDocHtml(filterPermissionBlocks(doc.body, () => decision));
      expect(html).not.toContain(":::");
      expect(html).not.toContain("<script");
    }
    expect(summaryOf(doc.body).length).toBeGreaterThan(0);
  });
});
