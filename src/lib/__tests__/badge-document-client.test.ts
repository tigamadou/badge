import { describe, expect, it } from "vitest";
import { PREVIEW_UNAVAILABLE, badgeDocumentUrl, fetchBadgeDocument } from "../badge-document-client";

const frozen = { html: "<p>x</p>", widthPx: 10, heightPx: 10, pages: [1], frozen: true };
const reply = (status: number, body: unknown) =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;

describe("badgeDocumentUrl", () => {
  it("vise la route du badge au format HTML", () => {
    expect(badgeDocumentUrl("o1", "e1", "111")).toBe("/api/org/o1/events/e1/badges/111?format=html");
  });
});

describe("fetchBadgeDocument", () => {
  it("renvoie le document fige", async () => {
    expect(await fetchBadgeDocument("/x", { fetch: reply(200, frozen) })).toEqual({ ok: true, document: frozen });
  });

  it("refuse un document non fige", async () => {
    expect(await fetchBadgeDocument("/x", { fetch: reply(200, { ...frozen, frozen: false }) })).toEqual({
      ok: false,
      message: PREVIEW_UNAVAILABLE,
    });
  });

  it.each([
    ["sans html", { ...frozen, html: 1 }],
    ["sans pages", { ...frozen, pages: "1" }],
    ["null", null],
  ])("refuse un corps %s", async (_label, body) => {
    expect((await fetchBadgeDocument("/x", { fetch: reply(200, body) })).ok).toBe(false);
  });

  it("transmet le message d'un 503", async () => {
    expect(await fetchBadgeDocument("/x", { fetch: reply(503, { message: "X" }) })).toEqual({
      ok: false,
      message: "X",
    });
  });

  it("utilise le libelle par defaut pour un 503 sans message", async () => {
    expect(await fetchBadgeDocument("/x", { fetch: reply(503, {}) })).toEqual({
      ok: false,
      message: PREVIEW_UNAVAILABLE,
    });
    expect(await fetchBadgeDocument("/x", { fetch: reply(503, null) })).toEqual({
      ok: false,
      message: PREVIEW_UNAVAILABLE,
    });
  });

  it("libelle par defaut pour un 500 et un JSON illisible", async () => {
    expect(await fetchBadgeDocument("/x", { fetch: reply(500, { error: "RENDER_FAILED" }) })).toEqual({
      ok: false,
      message: PREVIEW_UNAVAILABLE,
    });
    expect(await fetchBadgeDocument("/x", { fetch: reply(200, "pas du json") })).toEqual({
      ok: false,
      message: PREVIEW_UNAVAILABLE,
    });
  });

  it("ne rejette jamais : reseau et abandon", async () => {
    const reseau = (async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    expect((await fetchBadgeDocument("/x", { fetch: reseau })).ok).toBe(false);
    const controller = new AbortController();
    controller.abort();
    const abandon = (async (_url: unknown, options?: RequestInit) => {
      options?.signal?.throwIfAborted();
      return new Response("{}");
    }) as typeof fetch;
    expect((await fetchBadgeDocument("/x", { signal: controller.signal, fetch: abandon })).ok).toBe(false);
  });

  it("utilise le fetch global par defaut", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = reply(200, frozen);
    try {
      expect((await fetchBadgeDocument("/x")).ok).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
