import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listTemplates, readTemplate, writeManifest } from "./workshop";
import { listVariants } from "./contexts";
import { renderManifest } from "./render";

// Resolu depuis la racine du depot plutot que depuis le fichier : `package.json` ne
// declare pas `"type": "module"`, donc `import.meta.dirname` n'est pas disponible sous
// tsx, et `__dirname` n'existe pas quand Vitest charge le module en ESM. Le studio est
// toujours lance depuis la racine, par `make studio` comme par les tests.
const PUBLIC_DIR = resolve(process.cwd(), "studio", "public");

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function handle(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://studio");
  const path = url.pathname;

  const asset = req.method === "GET" ? STATIC_FILES[path] : undefined;
  if (asset) {
    const body = await readFile(join(PUBLIC_DIR, asset.file));
    res.writeHead(200, { "content-type": asset.type });
    res.end(body);
    return;
  }

  if (req.method === "GET" && path === "/api/variants") {
    sendJson(res, 200, { variants: listVariants() });
    return;
  }

  if (req.method === "GET" && path === "/api/templates") {
    sendJson(res, 200, { templates: await listTemplates(root) });
    return;
  }

  const templateMatch = /^\/api\/templates\/([^/]+)$/.exec(path);
  if (templateMatch) {
    const name = decodeURIComponent(templateMatch[1]);
    if (req.method === "GET") {
      const read = await readTemplate(root, name);
      if (!read) {
        sendJson(res, 404, { error: "TEMPLATE_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, { manifest: read.manifest, assets: read.assets.map((a) => a.path) });
      return;
    }
    if (req.method === "PUT") {
      const body = (await readBody(req)) as { manifest?: unknown } | null;
      if (typeof body?.manifest !== "string") {
        sendJson(res, 400, { error: "INVALID_BODY" });
        return;
      }
      const written = await writeManifest(root, name, body.manifest);
      sendJson(res, written ? 200 : 404, written ? { ok: true } : { error: "TEMPLATE_NOT_FOUND" });
      return;
    }
  }

  if (req.method === "POST" && path === "/api/render") {
    const body = (await readBody(req)) as
      | { name?: unknown; manifest?: unknown; variant?: unknown }
      | null;
    if (
      typeof body?.name !== "string" ||
      typeof body.manifest !== "string" ||
      typeof body.variant !== "string"
    ) {
      sendJson(res, 400, { error: "INVALID_BODY" });
      return;
    }
    const read = await readTemplate(root, body.name);
    if (!read) {
      sendJson(res, 404, { error: "TEMPLATE_NOT_FOUND" });
      return;
    }
    // Le manifeste rendu est celui de l'editeur : on veut voir l'effet d'une
    // modification avant de l'enregistrer. Seules les ressources viennent du disque.
    const result = await renderManifest({
      manifest: body.manifest,
      assets: read.assets,
      variantId: body.variant,
    });
    if (!result.ok) {
      sendJson(res, 422, { errors: result.errors });
      return;
    }
    res.writeHead(200, { "content-type": "application/pdf", "cache-control": "no-store" });
    res.end(result.pdf);
    return;
  }

  sendJson(res, 404, { error: "NOT_FOUND" });
}

export function createStudioServer(root: string): Server {
  return createServer((req, res) => {
    handle(root, req, res).catch((err) => {
      console.error("[studio]", err);
      if (!res.headersSent) sendJson(res, 500, { error: "INTERNAL" });
      else res.end();
    });
  });
}

// Point d'entree : `yarn tsx studio/server.ts`. L'atelier est celui de
// make new-badge-template, a la racine du depot.
if (process.env.VITEST === undefined) {
  const port = Number(process.env.STUDIO_PORT ?? 3900);
  const root = resolve(process.cwd(), "badge-templates");
  createStudioServer(root).listen(port, () => {
    console.log(`Studio de templates : http://localhost:${port} (atelier ${root})`);
  });
}
