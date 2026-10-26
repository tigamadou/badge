import { afterEach, describe, expect, it } from "vitest";
import { ExportError } from "@tigamadou/pdf-engine/export";
import type { HtmlDocument } from "@tigamadou/pdf-engine/html";
import {
  RENDERER_UNAVAILABLE_MESSAGE,
  getExporter,
  isRendererUnavailable,
  overrideExporter,
  rendererUnavailableResponse,
} from "@/lib/renderer";
import { fakeExporter } from "./helpers/fake-exporter";

const doc: HtmlDocument = { html: "<html></html>", widthPx: 10, heightPx: 10, pages: [1], frozen: false };
const initialUrl = process.env.RENDERER_URL;

afterEach(() => {
  if (initialUrl === undefined) delete process.env.RENDERER_URL;
  else process.env.RENDERER_URL = initialUrl;
});

describe("getExporter", () => {
  it("rejette UNAVAILABLE sans RENDERER_URL, sans lever au chargement", async () => {
    overrideExporter(null);
    delete process.env.RENDERER_URL;
    const exporter = getExporter();
    for (const call of [
      () => exporter.freeze(doc),
      () => exporter.pdf(doc),
      () => exporter.image(doc, { format: "png", page: 1 }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "UNAVAILABLE", message: expect.stringContaining("RENDERER_URL") });
    }
  });

  it("memoise par valeur de RENDERER_URL et traduit un refus de connexion", async () => {
    overrideExporter(null);
    process.env.RENDERER_URL = "http://127.0.0.1:1";
    const first = getExporter();
    expect(getExporter()).toBe(first);
    await expect(first.pdf(doc)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    process.env.RENDERER_URL = "http://127.0.0.1:2";
    expect(getExporter()).not.toBe(first);
  });

  it("overrideExporter remplace puis rétablit le service", () => {
    overrideExporter(fakeExporter);
    expect(getExporter()).toBe(fakeExporter);
    overrideExporter(null);
    expect(getExporter()).not.toBe(fakeExporter);
  });
});

describe("isRendererUnavailable", () => {
  it("n'est vrai que pour UNAVAILABLE et TIMEOUT", () => {
    expect(isRendererUnavailable(new ExportError("UNAVAILABLE", "x"))).toBe(true);
    expect(isRendererUnavailable(new ExportError("TIMEOUT", "x"))).toBe(true);
    expect(isRendererUnavailable(new ExportError("RENDER_FAILED", "x"))).toBe(false);
    expect(isRendererUnavailable(new ExportError("INVALID_PAGE", "x"))).toBe(false);
    expect(isRendererUnavailable(new Error("x"))).toBe(false);
    expect(isRendererUnavailable(undefined)).toBe(false);
  });
});

describe("rendererUnavailableResponse", () => {
  it("répond 503 avec retry-after", async () => {
    const res = rendererUnavailableResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(await res.json()).toEqual({ error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE });
  });
});

describe("fakeExporter", () => {
  it("fige, produit un PDF et une image, et enregistre les appels", async () => {
    const live: HtmlDocument = { ...doc, html: "<p>a⁠b</p><script>x()</script>", pages: [1, 2] };
    const frozen = await fakeExporter.freeze(live);
    expect(frozen).toMatchObject({ frozen: true, html: "<p>ab</p>" });
    const pdf = await fakeExporter.pdf(live);
    expect(new TextDecoder().decode(pdf).match(/\/Type \/Page /g)).toHaveLength(2);
    const png = await fakeExporter.image(live, { format: "png", page: 1 });
    expect(png[0]).toBe(0x89);
    expect(fakeExporter.calls.map((c) => c.op)).toEqual(["freeze", "pdf", "image"]);
    expect(fakeExporter.calls[2].opts).toEqual({ format: "png", page: 1 });
  });

  it("failNext fait rejeter l'appel suivant seulement", async () => {
    fakeExporter.failNext("TIMEOUT");
    await expect(fakeExporter.pdf(doc)).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(fakeExporter.pdf(doc)).resolves.toBeInstanceOf(Uint8Array);
  });
});
