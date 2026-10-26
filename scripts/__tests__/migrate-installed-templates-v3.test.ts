import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateManifest } from "@tigamadou/pdf-engine";
import { prisma } from "@/lib/prisma";
import { deleteFile, getFile, uploadFile } from "@/lib/storage";
import { fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";
import { migrateInstalledTemplatesV3 } from "../migrate-installed-templates-v3";

// Ce fichier ecrit DIRECTEMENT en base (contournement volontaire du chemin
// d'installation) sur des identifiants fixes. La base de test EST la base de dev et
// test-setup.ts ne reinitialise pas InstalledBadgeTemplate : nettoyage avant ET apres,
// pour qu'un run avorte ne fausse pas un `make migrate-installed-templates` ulterieur.
const IDS = ["m1", "m2", "m3", "m4", "m5"];

async function cleanup(): Promise<void> {
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: IDS } } });
  await prisma.user.deleteMany({ where: { email: { in: IDS.map((id) => `${id}@test.local`) } } });
  for (const id of IDS) {
    for (const name of ["proof.png", "proof.pdf"]) await deleteFile(`badge-templates/${id}/${name}`).catch(() => {});
  }
}

beforeEach(cleanup);
afterEach(cleanup);

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
  ],
};

const LAYOUT_V2 = {
  formatVersion: 2,
  family: "salon",
  label: "Salon",
  description: "",
  category: "badge",
  page: { widthPx: 300, heightPx: 200, count: 1 },
  variables: [{ name: "nom", kind: "text", label: "Nom", sample: "Awa" }],
  blocks: [
    {
      type: "text",
      page: 1,
      x: 10,
      y: 10,
      w: 200,
      h: 30,
      text: "{nom}",
      style: { sizePx: 12, color: "#000000", overflow: "clip" },
    },
  ],
};

async function installRow(
  id: string,
  o: { formatVersion?: 1 | 2; layout?: unknown; bindings?: unknown; archived?: boolean } = {},
) {
  const formatVersion = o.formatVersion ?? 2;
  const user = await prisma.user.create({ data: { email: `${id}@test.local`, name: "Test", password: "x" } });
  await prisma.installedBadgeTemplate.create({
    data: {
      id,
      family: `legacy-${id}`,
      version: 1,
      label: "Ancien badge",
      description: "Ligne de test",
      pages: 1,
      pageWidthPx: 300,
      pageHeightPx: 200,
      layout: (o.layout ?? (formatVersion === 1 ? LAYOUT_V1 : LAYOUT_V2)) as object,
      bindings: (o.bindings ?? (formatVersion === 1 ? {} : { nom: "participant.firstName" })) as object,
      assetPrefix: `badge-templates/${id}/`,
      formatVersion,
      archived: o.archived ?? false,
      installedById: user.id,
    },
  });
}

const row = (id: string) => prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id } });

describe("migrateInstalledTemplatesV3", () => {
  it("ne touche a rien en dry-run, mais valide le rendu par le service", async () => {
    await installRow("m1");
    const report = await migrateInstalledTemplatesV3({ apply: false });
    expect(report.migrated).toEqual([{ id: "m1", from: 2, proofPath: "badge-templates/m1/proof.png" }]);
    expect(report.applied).toBe(false);
    const after = await row("m1");
    expect(after.formatVersion).toBe(2);
    expect(after.proofPath).toBeNull();
    await expect(getFile("badge-templates/m1/proof.png")).rejects.toBeDefined();
    expect(fakeExporter.calls.filter((c) => c.op === "image")).toHaveLength(1);
  });

  it("applique : layout et format 3, epreuve PNG stockee, proof.pdf conserve", async () => {
    await installRow("m2");
    await uploadFile("badge-templates/m2/proof.pdf", Buffer.from("%PDF-1.7"), "application/pdf");
    const report = await migrateInstalledTemplatesV3({ apply: true });
    expect(report.applied).toBe(true);
    const after = await row("m2");
    expect(after.formatVersion).toBe(3);
    expect((after.layout as { formatVersion: number }).formatVersion).toBe(3);
    expect(after.layout).toEqual(migrateManifest(LAYOUT_V2));
    expect(after.proofPath).toBe("badge-templates/m2/proof.png");
    const png = await getFile("badge-templates/m2/proof.png");
    expect([...png.body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect((await getFile("badge-templates/m2/proof.pdf")).body.toString()).toBe("%PDF-1.7");
  });

  it("migre une ligne v1 en chaine avec les liaisons identite", async () => {
    await installRow("m3", { formatVersion: 1 });
    const report = await migrateInstalledTemplatesV3({ apply: true });
    expect(report.migrated.find((m) => m.id === "m3")?.from).toBe(1);
    const after = await row("m3");
    expect(after.formatVersion).toBe(3);
    expect((after.layout as { variables: unknown[] }).variables).toHaveLength(15);
    expect((after.bindings as Record<string, string>)["participant.firstName"]).toBe("participant.firstName");
  });

  it("migre aussi une ligne archivee", async () => {
    await installRow("m4", { archived: true });
    const report = await migrateInstalledTemplatesV3({ apply: true });
    expect(report.migrated.map((m) => m.id)).toContain("m4");
    expect((await row("m4")).formatVersion).toBe(3);
  });

  it("n'ecrit rien en base quand une ligne est sautee (validation)", async () => {
    await installRow("m1");
    await installRow("m5", { layout: { formatVersion: 2, blocks: [{ type: "text" }] } });
    const report = await migrateInstalledTemplatesV3({ apply: true });
    const bad = report.skipped.find((s) => s.id === "m5");
    expect(bad?.reason).toMatch(/^validation :/);
    expect(report.applied).toBe(false);
    expect((await row("m1")).formatVersion).toBe(2);
    expect((await row("m5")).formatVersion).toBe(2);
  });

  it("saute une ligne dont la migration echoue", async () => {
    await installRow("m5", { layout: "illisible" });
    const report = await migrateInstalledTemplatesV3({ apply: false });
    expect(report.skipped).toEqual([{ id: "m5", reason: expect.stringMatching(/^migration :/) }]);
  });

  it("saute une ligne v2 aux liaisons incompletes", async () => {
    await installRow("m5", { bindings: {} });
    const report = await migrateInstalledTemplatesV3({ apply: false });
    expect(report.skipped[0].reason).toMatch(/^liaisons :/);
  });

  it("charge les ressources du paquet pour l'epreuve", async () => {
    await uploadFile("badge-templates/m5/assets/apercu.png", Buffer.from("IMG"), "image/png");
    await installRow("m5", { layout: { ...LAYOUT_V2, preview: "assets/apercu.png" } });
    try {
      const report = await migrateInstalledTemplatesV3({ apply: false });
      expect(report.skipped).toEqual([]);
      expect(report.migrated.map((m) => m.id)).toContain("m5");
    } finally {
      await deleteFile("badge-templates/m5/assets/apercu.png");
    }
  });

  it("saute la ligne, en le disant, quand le service de rendu est indisponible", async () => {
    await installRow("m1");
    fakeExporter.failNext("UNAVAILABLE");
    const report = await migrateInstalledTemplatesV3({ apply: true });
    expect(report.skipped[0].reason).toContain("service de rendu");
    expect(report.applied).toBe(false);
    expect((await row("m1")).formatVersion).toBe(2);
  });

  it("saute la ligne quand le rendu echoue", async () => {
    await installRow("m1");
    fakeExporter.failNext("RENDER_FAILED");
    const report = await migrateInstalledTemplatesV3({ apply: false });
    expect(report.skipped[0].reason).toMatch(/^rendu :/);
  });

  it("est idempotent : un second passage ne migre ni ne saute rien", async () => {
    await installRow("m1");
    await migrateInstalledTemplatesV3({ apply: true });
    const second = await migrateInstalledTemplatesV3({ apply: true });
    expect(second.migrated).toEqual([]);
    expect(second.skipped).toEqual([]);
  });
});
