import { ExportError } from "@tigamadou/pdf-engine/export";
import type { ExportErrorCode, Exporter, ImageOptions } from "@tigamadou/pdf-engine/export";
import type { HtmlDocument } from "@tigamadou/pdf-engine/html";

export type FakeCall = { op: "freeze" | "pdf" | "image"; doc: HtmlDocument; opts?: ImageOptions };
export type FakeExporter = Exporter & {
  calls: FakeCall[];
  failNext(code: ExportErrorCode): void;
  reset(): void;
};

export const FAKE_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

export function countPdfPages(buf: Uint8Array): number {
  return Buffer.from(buf).toString("latin1").match(/\/Type \/Page /g)?.length ?? 0;
}

let pending: ExportErrorCode | null = null;

function enter(op: FakeCall["op"], doc: HtmlDocument, opts?: ImageOptions) {
  fakeExporter.calls.push({ op, doc, opts });
  if (pending) {
    const code = pending;
    pending = null;
    throw new ExportError(code, "faux exporteur");
  }
}

export const fakeExporter: FakeExporter = {
  calls: [],
  failNext(code) {
    pending = code;
  },
  reset() {
    fakeExporter.calls = [];
    pending = null;
  },
  async freeze(doc) {
    enter("freeze", doc);
    const html = doc.html.replace(/<script[\s\S]*?<\/script>/g, "").replaceAll("⁠", "");
    return { ...doc, frozen: true, html };
  },
  async pdf(doc) {
    enter("pdf", doc);
    const pages = doc.pages.map(() => "<< /Type /Page >>\n").join("");
    return new TextEncoder().encode(`%PDF-1.7\n${pages}%%EOF`);
  },
  async image(doc, opts) {
    enter("image", doc, opts);
    return FAKE_PNG;
  },
};
