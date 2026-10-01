import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadWithProgress } from "../upload-with-progress";

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  open = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  constructor() {
    FakeXhr.last = this;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("uploadWithProgress", () => {
  it("rapporte la progression et rend statut et JSON", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress: number[] = [];
    const promise = uploadWithProgress("/api/x", new FormData(), (p) => progress.push(p));
    const xhr = FakeXhr.last;
    expect(xhr.open).toHaveBeenCalledWith("POST", "/api/x");
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    xhr.status = 201;
    xhr.responseText = '{"ok":true}';
    xhr.onload?.();
    await expect(promise).resolves.toEqual({ status: 201, json: { ok: true } });
    expect(progress).toEqual([25, 100]);
  });

  it("rend json null pour une reponse illisible", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    FakeXhr.last.status = 500;
    FakeXhr.last.responseText = "<html>";
    FakeXhr.last.onload?.();
    await expect(promise).resolves.toEqual({ status: 500, json: null });
  });

  it("rejette NETWORK sur erreur reseau", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    FakeXhr.last.onerror?.();
    await expect(promise).rejects.toThrow("NETWORK");
  });

  it("annule la requete sur abandon", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {}, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last.abort).toHaveBeenCalled();
  });

  it("rejette AbortError si le signal est deja abandonne", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();
    controller.abort();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {}, controller.signal);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last.send).not.toHaveBeenCalled();
  });
});
