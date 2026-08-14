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

describe("POST /api/templates/:name/assets", () => {
  const PNG_BASE64 = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
  ]).toString("base64");

  const upload = (name: string, body: unknown) =>
    fetch(`${base}/api/templates/${name}/assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("ecrit la ressource dans l'atelier", async () => {
    const res = await upload("salon", { dir: "assets", filename: "fond.png", dataBase64: PNG_BASE64 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, path: "assets/fond.png" });

    const read = await fetch(`${base}/api/templates/salon`).then((r) => r.json());
    expect(read.assets).toContain("assets/fond.png");
  });

  it("repond 422 pour un contenu refuse", async () => {
    const res = await upload("salon", {
      dir: "assets",
      filename: "note.png",
      dataBase64: Buffer.from("bonjour").toString("base64"),
    });
    expect(res.status).toBe(422);
  });

  it("repond 400 pour un corps malforme", async () => {
    expect((await upload("salon", { dir: "images", filename: "a.png", dataBase64: PNG_BASE64 })).status).toBe(400);
    expect((await upload("salon", { dir: "assets", dataBase64: PNG_BASE64 })).status).toBe(400);
  });

  it("repond 422 pour un template inconnu", async () => {
    const res = await upload("inconnu", { dir: "assets", filename: "fond.png", dataBase64: PNG_BASE64 });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/templates", () => {
  const create = (body: unknown) =>
    fetch(`${base}/api/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("cree un squelette et l'expose a la liste", async () => {
    expect((await create({ name: "forum" })).status).toBe(201);
    const list = await fetch(`${base}/api/templates`).then((r) => r.json());
    expect(list.templates.map((t: { name: string }) => t.name)).toContain("forum");
  });

  it("repond 409 quand le dossier existe deja", async () => {
    expect((await create({ name: "salon" })).status).toBe(409);
  });

  it("repond 400 pour un nom invalide", async () => {
    expect((await create({ name: "Pas Valide" })).status).toBe(400);
    expect((await create({})).status).toBe(400);
  });
});

describe("POST /api/templates/:name/pack", () => {
  const pack = (name: string, manifest: unknown) =>
    fetch(`${base}/api/templates/${name}/pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest }),
    });

  it("renvoie l'archive du template", async () => {
    const res = await pack("salon", MINIMAL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain('filename="salon.zip"');
    const zip = Buffer.from(await res.arrayBuffer());
    expect(zip.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("repond 422 pour un manifeste invalide", async () => {
    expect((await pack("salon", "{ pas du json")).status).toBe(422);
  });

  it("repond 400 sans manifeste", async () => {
    const res = await fetch(`${base}/api/templates/salon/pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
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
