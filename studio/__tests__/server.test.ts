import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createStudioServer } from "../server";

const MINIMAL = JSON.stringify({
  formatVersion: 1,
  family: "test-mini",
  label: "Test minimal",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 2,
      y: 2,
      w: 40,
      h: 6,
      text: "{participant.firstName}",
      style: { sizePx: 42, color: "#0f172a", overflow: "clip" },
    },
  ],
});

let root: string;
let server: Server;
let base: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-server-"));
  await mkdir(join(root, "salon"));
  await writeFile(join(root, "salon", "manifest.json"), MINIMAL);
  server = createStudioServer(root);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
});

describe("GET /api/templates", () => {
  it("liste l'atelier", async () => {
    const res = await fetch(`${base}/api/templates`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ templates: [{ name: "salon", hasManifest: true }] });
  });
});

describe("GET /api/schema-info", () => {
  it("expose les informations de schema", async () => {
    const res = await fetch(`${base}/api/schema-info`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources["participant.firstName"]).toBe("text");
    expect(body.conditionPaths).toContain("category.anonymous");
    expect(body.presets.map((p: { id: string }) => p.id)).toContain("anonyme");
    expect(body.minTextHeightRatio).toBe(1.45);
  });

  it("ne sert plus /api/variants", async () => {
    expect((await fetch(`${base}/api/variants`)).status).toBe(404);
  });
});

describe("GET /api/templates/:name", () => {
  it("rend le manifeste et les ressources", async () => {
    const res = await fetch(`${base}/api/templates/salon`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ manifest: MINIMAL, assets: [] });
  });

  it("repond 404 pour un nom invalide ou inconnu", async () => {
    expect((await fetch(`${base}/api/templates/inconnu`)).status).toBe(404);
    expect((await fetch(`${base}/api/templates/Salon`)).status).toBe(404);
  });
});

describe("PUT /api/templates/:name", () => {
  it("ecrit le manifeste sur le disque", async () => {
    const res = await fetch(`${base}/api/templates/salon`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: '{"a":1}' }),
    });

    expect(res.status).toBe(200);
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe('{"a":1}');
  });

  it("repond 404 pour un dossier absent", async () => {
    const res = await fetch(`${base}/api/templates/inconnu`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: "{}" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("statiques", () => {
  it("refuse un chemin traversant sous /vendor", async () => {
    expect((await fetch(`${base}/vendor/../server.ts`)).status).toBe(404);
  });

  it("repond 404 pour un module vendor absent", async () => {
    expect((await fetch(`${base}/vendor/absent.mjs`)).status).toBe(404);
  });
});

describe("POST /api/render", () => {
  it("rend avec un contexte partiel fourni", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "salon",
        manifest: MINIMAL,
        context: { participant: { firstName: "Zoé" } },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("repond 400 pour un contexte qui n'est pas un objet", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "salon", manifest: MINIMAL, context: "complet" }),
    });
    expect(res.status).toBe(400);
  });

  it("rend le texte recu, pas le fichier", async () => {
    const modifie = JSON.parse(MINIMAL);
    modifie.label = "Jamais enregistre";
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "salon", manifest: JSON.stringify(modifie) }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Le fichier sur disque n'a pas bouge.
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe(MINIMAL);
  });

  it("repond 422 avec les erreurs pour un manifeste invalide", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "salon", manifest: "{ pas du json" }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ errors: ["Manifeste invalide : JSON illisible."] });
  });

  it("repond 404 pour un template inconnu", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "inconnu", manifest: MINIMAL }),
    });
    expect(res.status).toBe(404);
  });
});
