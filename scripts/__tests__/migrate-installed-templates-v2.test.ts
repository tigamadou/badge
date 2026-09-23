import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { migrateInstalledTemplates } from "../migrate-installed-templates-v2";

// Ce fichier ecrit DIRECTEMENT en base (contournement volontaire du chemin
// d'installation, cf. plus bas) sur des identifiants fixes. La base de test EST
// la base de dev (DATABASE_URL unique, cf. .env) et test-setup.ts ne reinitialise
// pas InstalledBadgeTemplate : sans ce nettoyage, ces lignes fuiraient dans la
// base de dev partagee et fausseraient une execution ulterieure de
// `make migrate-installed-templates` (un t4 laisse par un run avorte serait
// compte comme "saute" a tort). Nettoyage avant ET apres : avant, pour repartir
// d'un etat propre meme si un run precedent a ete interrompu ; apres, pour ne
// rien laisser trainer dans la base de dev.
const IDS = ["t1", "t2", "t3", "t4"];

async function cleanup(): Promise<void> {
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: IDS } } });
  await prisma.user.deleteMany({ where: { email: { in: IDS.map((id) => `${id}@test.local`) } } });
}

beforeEach(cleanup);
afterEach(cleanup);

// Une ligne v1 posee DIRECTEMENT en base : le chemin d'installation n'accepte
// plus le format v1, c'est justement l'etat qu'on vient reparer.
const LAYOUT_V1 = {
  formatVersion: 1,
  family: "legacy",
  label: "Ancien badge",
  description: "Ligne v1 de test",
  page: { widthPx: 323.53, heightPx: 204.09, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 20,
      y: 20,
      w: 200,
      h: 30,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
    },
    {
      type: "rect",
      page: 1,
      x: 20,
      y: 60,
      w: 80,
      h: 80,
      image: { source: "participant.photoDataUrl", fit: "cover" },
      visibleIf: { path: "category.anonymous", equals: false },
    },
  ],
};

async function installV1Row(id: string) {
  // L'utilisateur installateur : meme fabrication que dans les tests voisins
  // (cf. src/lib/badge-templates/__tests__/install.test.ts).
  const user = await prisma.user.create({
    data: { email: `${id}@test.local`, name: "Test", password: "x" },
  });
  await prisma.installedBadgeTemplate.create({
    data: {
      id,
      family: `legacy-${id}`,
      version: 1,
      label: "Ancien badge",
      description: "Ligne v1 de test",
      pages: 1,
      pageWidthPx: 323.53,
      pageHeightPx: 204.09,
      layout: LAYOUT_V1,
      assetPrefix: `badge-templates/${id}/`,
      formatVersion: 1,
      installedById: user.id,
    },
  });
}

describe("migrateInstalledTemplates", () => {
  it("ne touche a rien en dry-run", async () => {
    await installV1Row("t1");
    const report = await migrateInstalledTemplates({ apply: false });
    expect(report.migrated).toEqual(["t1"]);
    const row = await prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id: "t1" } });
    expect(row.formatVersion).toBe(1);
  });

  it("migre le layout, pose la table par identite et passe en v2", async () => {
    await installV1Row("t2");
    await migrateInstalledTemplates({ apply: true });
    const row = await prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id: "t2" } });
    expect(row.formatVersion).toBe(2);
    expect((row.layout as { variables: unknown[] }).variables).toHaveLength(15);
    expect((row.bindings as Record<string, string>)["participant.firstName"]).toBe(
      "participant.firstName",
    );
  });

  it("est idempotent", async () => {
    await installV1Row("t3");
    await migrateInstalledTemplates({ apply: true });
    const second = await migrateInstalledTemplates({ apply: true });
    expect(second.migrated).toEqual([]);
  });

  it("saute et rapporte une ligne dont le manifeste migre ne valide pas", async () => {
    await installV1Row("t4");
    await prisma.installedBadgeTemplate.update({
      where: { id: "t4" },
      data: { layout: { formatVersion: 1, blocks: [{ type: "text" }] } },
    });
    const report = await migrateInstalledTemplates({ apply: true });
    expect(report.skipped.map((s) => s.id)).toContain("t4");
  });
});
