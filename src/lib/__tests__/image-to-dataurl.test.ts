import { describe, it, expect, vi, afterEach } from "vitest";
import { imageUrlToDataUrl } from "@/lib/image-to-dataurl";

type Handler = (() => void) | null;
type FakeCtx = { drawImage: ReturnType<typeof vi.fn> } | null;

// L'environnement de test est "node" : ni `Image`, ni `document`, ni `canvas`
// n'existent. On stub ces globals pour piloter les branches onload/onerror et
// la disponibilite du contexte 2d.
function installDom({ ctx, fail = false }: { ctx: FakeCtx; fail?: boolean }) {
  const toDataURL = vi.fn(() => "data:image/png;base64,ABC");
  const getContext = vi.fn(() => ctx);
  const canvas = { width: 0, height: 0, getContext, toDataURL };

  class FakeImage {
    crossOrigin = "";
    naturalWidth = 120;
    naturalHeight = 80;
    onload: Handler = null;
    onerror: Handler = null;
    #src = "";
    set src(value: string) {
      this.#src = value;
      // Declenche le handler de facon asynchrone, comme le chargement reel.
      queueMicrotask(() => {
        if (fail) this.onerror?.();
        else this.onload?.();
      });
    }
    get src() {
      return this.#src;
    }
  }

  const createElement = vi.fn(() => canvas);
  vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
  vi.stubGlobal("document", { createElement });
  return { canvas, getContext, toDataURL, createElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("imageUrlToDataUrl", () => {
  it("resolves to a PNG data URL when the image loads", async () => {
    const drawImage = vi.fn();
    const { canvas, toDataURL, createElement } = installDom({ ctx: { drawImage } });

    const url = await imageUrlToDataUrl("https://example.com/img.webp");

    expect(url).toBe("data:image/png;base64,ABC");
    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(80);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(toDataURL).toHaveBeenCalledWith("image/png");
  });

  it("rejects when the 2d context is unavailable", async () => {
    const drawn = installDom({ ctx: null });
    await expect(imageUrlToDataUrl("https://example.com/a.png")).rejects.toThrow(
      "Canvas context not available",
    );
    // Le contexte manquant coupe court avant tout dessin.
    expect(drawn.toDataURL).not.toHaveBeenCalled();
  });

  it("rejects with the URL when the image fails to load", async () => {
    installDom({ ctx: { drawImage: vi.fn() }, fail: true });
    await expect(imageUrlToDataUrl("https://example.com/bad.png")).rejects.toThrow(
      "Failed to load image: https://example.com/bad.png",
    );
  });
});
