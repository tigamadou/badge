import { NextResponse } from "next/server";
import { ExportError } from "@tigamadou/pdf-engine/export";
import type { Exporter } from "@tigamadou/pdf-engine/export";
import { createServiceExporter } from "@tigamadou/pdf-engine/export/service";

export const RENDERER_TIMEOUT_MS = 30_000;
export const RENDERER_UNAVAILABLE_MESSAGE =
  "Le service de rendu des badges est indisponible. Réessayez dans un instant.";

const MISSING_URL = "RENDERER_URL n'est pas défini : le service de rendu est injoignable.";

// Sans URL, l'erreur est levée à l'appel et non au chargement : `next build` importe les routes.
const unconfigured: Exporter = {
  freeze: () => Promise.reject(new ExportError("UNAVAILABLE", MISSING_URL)),
  pdf: () => Promise.reject(new ExportError("UNAVAILABLE", MISSING_URL)),
  image: () => Promise.reject(new ExportError("UNAVAILABLE", MISSING_URL)),
};

let override: Exporter | null = null;
let cached: { url: string; exporter: Exporter } | null = null;

export function getExporter(): Exporter {
  if (override) return override;
  const url = process.env.RENDERER_URL;
  if (!url) return unconfigured;
  if (cached?.url !== url) {
    cached = { url, exporter: createServiceExporter({ url, timeoutMs: RENDERER_TIMEOUT_MS }) };
  }
  return cached.exporter;
}

// Tests uniquement : null rétablit le service.
export function overrideExporter(exporter: Exporter | null): void {
  override = exporter;
}

export function isRendererUnavailable(err: unknown): err is ExportError {
  return err instanceof ExportError && (err.code === "UNAVAILABLE" || err.code === "TIMEOUT");
}

export function rendererUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "RENDERER_UNAVAILABLE", message: RENDERER_UNAVAILABLE_MESSAGE },
    { status: 503, headers: { "retry-after": "5" } },
  );
}
