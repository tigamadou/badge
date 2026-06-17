import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BADGE_TEMPLATES,
  getTemplate,
  listTemplates,
  DEFAULT_TEMPLATE_ID,
} from "../index";

describe("BADGE_TEMPLATES registry", () => {
  it("contient au moins un template", () => {
    expect(Object.keys(BADGE_TEMPLATES).length).toBeGreaterThanOrEqual(1);
  });

  it("expose default-v1", () => {
    expect(BADGE_TEMPLATES["default-v1"]).toBeDefined();
    expect(DEFAULT_TEMPLATE_ID).toBe("default-v1");
  });
});

describe("getTemplate", () => {
  it("renvoie le template existant", () => {
    const t = getTemplate("default-v1");
    expect(t).not.toBeNull();
    expect(t?.meta.id).toBe("default-v1");
    expect(typeof t?.Component).toBe("function");
  });

  it("renvoie null pour un id inconnu", () => {
    expect(getTemplate("inconnu-xyz")).toBeNull();
  });
});

describe("listTemplates", () => {
  it("renvoie tous les templates du registry", () => {
    expect(listTemplates().length).toBe(Object.keys(BADGE_TEMPLATES).length);
  });
});

describe("validation TemplateMeta", () => {
  for (const [key, tpl] of Object.entries(BADGE_TEMPLATES)) {
    it(`meta de ${key} est valide`, () => {
      expect(tpl.meta.id).toBe(key);
      expect(tpl.meta.label.length).toBeGreaterThan(0);
      expect(tpl.meta.description.length).toBeGreaterThan(0);
      expect(tpl.meta.pages).toBeGreaterThanOrEqual(1);
      expect(tpl.meta.version).toBeGreaterThanOrEqual(1);
      expect(tpl.meta.pageSize.width).toMatch(/^[\d.]+(mm|pt|in|cm)$/);
      expect(tpl.meta.pageSize.height).toMatch(/^[\d.]+(mm|pt|in|cm)$/);
      expect(tpl.meta.previewSrc).toBe(`/badge-previews/${key}.png`);
    });
  }
});

describe("preview PNG existant", () => {
  it.each(Object.entries(BADGE_TEMPLATES))("preview.png existe pour %s", (key) => {
    const p = path.resolve(__dirname, `../${key}/preview.png`);
    expect(fs.existsSync(p)).toBe(true);
  });
});
