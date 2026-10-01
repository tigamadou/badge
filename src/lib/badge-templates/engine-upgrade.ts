import { createHash } from "node:crypto";
import { createElement } from "react";
import type { InstalledBadgeTemplate } from "@prisma/client";
import {
  buildDeclarativeTemplate,
  parseManifest,
  samplesOf,
  type AssetResolver,
  type TemplateManifest,
  type VariableValues,
} from "@tigamadou/pdf-engine";
import type { PackageAsset } from "@tigamadou/pdf-engine/package";
import { renderProof } from "@tigamadou/pdf-engine/proof";
import { renderTreeFingerprint } from "@tigamadou/pdf-engine/testing";
import enginePackage from "@tigamadou/pdf-engine/package.json";
import { prisma } from "@/lib/prisma";
import { getFile, uploadFile } from "@/lib/storage";
import { referencedAssets } from "./resolve";

// Verification d'une montee de version du moteur : chaque template installe est
// rendu avec ses echantillons et ses prereglages, et l'empreinte de chaque rendu est
// comparee a la reference enregistree lors de la verification precedente. Un badge
// deja emis est re-rendu a la demande : un rendu qui change change son apparence.

export const ENGINE_VERSION: string = enginePackage.version;
export const BASELINE_KEY = "badge-templates/_engine/fingerprints.json";

type Identity = { id: string; family: string; version: number };

export type TemplateCheck =
  | (Identity & { status: "refused"; errors: string[] })
  | (Identity & {
      status: "ok";
      fingerprints: Record<string, string>;
      manifest: TemplateManifest;
      assets: PackageAsset[];
    });

export type Baseline = {
  engineVersion: string;
  checkedAt: string;
  templates: Record<string, Record<string, string>>;
};

export type UpgradeReport = {
  engineVersion: string;
  baselineVersion: string | null;
  refused: Array<Identity & { errors: string[] }>;
  changed: Array<Identity & { variants: string[]; proofPath: string }>;
  unchanged: Identity[];
  fresh: Array<Identity & { proofPath?: string }>;
  baselineWritten: boolean;
};

function imageNames(manifest: TemplateManifest): Set<string> {
  return new Set(manifest.variables.filter((v) => v.kind === "image").map((v) => v.name));
}

// Tout ce qu'un rendu de verification lit : ressources du layout, echantillons et
// valeurs de preset des variables image.
export function assetNamesFor(manifest: TemplateManifest): string[] {
  const images = imageNames(manifest);
  const fromSamples = manifest.variables.flatMap((v) =>
    v.kind === "image" && typeof v.sample === "string" && v.sample !== "" ? [v.sample] : [],
  );
  const fromPresets = (manifest.presets ?? []).flatMap((preset) =>
    Object.entries(preset.values).flatMap(([name, value]) =>
      images.has(name) && typeof value === "string" && value !== "" ? [value] : [],
    ),
  );
  // L'apercu est televerse a l'installation sous assetPrefix : il fait partie du template.
  const preview = typeof manifest.preview === "string" && manifest.preview !== "" ? [manifest.preview] : [];
  return [...new Set([...referencedAssets(manifest), ...fromSamples, ...fromPresets, ...preview])].sort();
}

export function variantsOf(
  manifest: TemplateManifest,
  resolver: AssetResolver,
): Array<{ name: string; values: VariableValues }> {
  const images = imageNames(manifest);
  const base = samplesOf(manifest.variables, resolver);
  return [
    { name: "echantillons", values: base },
    ...(manifest.presets ?? []).map((preset) => ({
      name: `prereglage ${preset.label}`,
      values: {
        ...base,
        ...Object.fromEntries(
          Object.entries(preset.values).map(([name, value]) => [
            name,
            images.has(name) && typeof value === "string" && value !== "" ? resolver(value) : value,
          ]),
        ),
      },
    })),
  ];
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export async function checkTemplate(row: InstalledBadgeTemplate): Promise<TemplateCheck> {
  const identity = { id: row.id, family: row.family, version: row.version };
  if (row.formatVersion !== 2) {
    return {
      ...identity,
      status: "refused",
      errors: [`format v${row.formatVersion} : migrer le template (make migrate-installed-templates).`],
    };
  }

  const raw = row.layout as unknown as TemplateManifest;
  let names: string[];
  try {
    names = assetNamesFor(raw);
  } catch {
    // Layout illisible : parseManifest dira precisement pourquoi.
    names = [];
  }
  const parsed = parseManifest(raw, names);
  if (!parsed.ok) return { ...identity, status: "refused", errors: parsed.errors };

  const assets: PackageAsset[] = [];
  for (const name of names) {
    try {
      const file = await getFile(`${row.assetPrefix}${name}`);
      assets.push({ path: name, body: file.body, contentType: file.contentType });
    } catch {
      return { ...identity, status: "refused", errors: [`ressource "${name}" absente du stockage.`] };
    }
  }

  const urls = new Map(
    assets.map((a) => [a.path, `data:${a.contentType};base64,${a.body.toString("base64")}`]),
  );
  const resolver: AssetResolver = (name) => {
    const url = urls.get(name);
    /* v8 ignore next -- assetNamesFor couvre toutes les ressources lues par le rendu */
    if (!url) throw new Error(`ressource "${name}" non chargee`);
    return url;
  };

  // Empreinte de ce que l'application rend : le layout brut, comme resolve.ts.
  const { Component } = buildDeclarativeTemplate(raw, resolver, row.id);
  const fingerprints: Record<string, string> = {};
  for (const variant of variantsOf(raw, resolver)) {
    fingerprints[variant.name] = sha256(
      renderTreeFingerprint(createElement(Component, { values: variant.values })),
    );
  }
  return { ...identity, status: "ok", fingerprints, manifest: parsed.manifest, assets };
}

export async function loadBaseline(): Promise<Baseline | null> {
  try {
    const file = await getFile(BASELINE_KEY);
    return JSON.parse(file.body.toString("utf8")) as Baseline;
  } catch (error) {
    /* v8 ignore else -- panne du stockage : on ne la maquille pas en « aucune reference » */
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    /* v8 ignore start -- panne du stockage : on ne la maquille pas en « aucune reference » */
    throw error;
    /* v8 ignore stop */
  }
}

export async function verifyEngineUpgrade(options: { accept: boolean }): Promise<UpgradeReport> {
  const rows = await prisma.installedBadgeTemplate.findMany({
    orderBy: [{ family: "asc" }, { version: "asc" }],
  });
  const baseline = await loadBaseline();
  const report: UpgradeReport = {
    engineVersion: ENGINE_VERSION,
    baselineVersion: baseline?.engineVersion ?? null,
    refused: [],
    changed: [],
    unchanged: [],
    fresh: [],
    baselineWritten: false,
  };
  const next: Baseline["templates"] = {};

  for (const row of rows) {
    const identity = { id: row.id, family: row.family, version: row.version };
    const check = await checkTemplate(row);
    if (check.status === "refused") {
      report.refused.push({ ...identity, errors: check.errors });
      continue;
    }
    next[row.id] = check.fingerprints;
    const previous = baseline?.templates[row.id];
    const proofPath = `${row.assetPrefix}proof-engine-${ENGINE_VERSION}.pdf`;
    const writeProof = async () =>
      uploadFile(proofPath, await renderProof(check.manifest, check.assets, row.id), "application/pdf");
    if (!previous) {
      // Installe apres la derniere reference : son epreuve est regeneree pour etre
      // comparee a celle de l'installation. Sans reference du tout, rien a comparer.
      if (baseline !== null) {
        await writeProof();
        report.fresh.push({ ...identity, proofPath });
      } else {
        report.fresh.push(identity);
      }
      continue;
    }
    const variants = Object.keys(check.fingerprints)
      .filter((name) => previous[name] !== check.fingerprints[name])
      .sort();
    if (variants.length === 0) {
      report.unchanged.push(identity);
      continue;
    }
    await writeProof();
    report.changed.push({ ...identity, variants, proofPath });
  }

  // Un template refuse bloque : enregistrer la reference entérinerait un etat casse.
  if (options.accept && report.refused.length === 0) {
    const content: Baseline = {
      engineVersion: ENGINE_VERSION,
      checkedAt: new Date().toISOString(),
      templates: next,
    };
    await uploadFile(BASELINE_KEY, Buffer.from(`${JSON.stringify(content, null, 2)}\n`), "application/json");
    report.baselineWritten = true;
  }
  return report;
}

export function formatReport(report: UpgradeReport): string {
  const label = (t: Identity) => `${t.family} v${t.version} (${t.id})`;
  return [
    `Moteur @tigamadou/pdf-engine ${report.engineVersion} (référence : ${report.baselineVersion ?? "aucune"})`,
    `Refusés (bloquant) : ${report.refused.length}`,
    ...report.refused.map((t) => `  - ${label(t)} : ${t.errors.join(" ; ")}`),
    `Rendus changés (à examiner) : ${report.changed.length}`,
    ...report.changed.map((t) => `  - ${label(t)} : ${t.variants.join(", ")} -> épreuve ${t.proofPath}`),
    `Inchangés : ${report.unchanged.length}`,
    `Sans référence : ${report.fresh.length}`,
    ...report.fresh.map((t) => `  - ${label(t)}${t.proofPath ? ` -> épreuve ${t.proofPath}` : ""}`),
    report.baselineWritten
      ? "Référence enregistrée."
      : "Référence non enregistrée (relancer avec --accept après examen).",
  ].join("\n");
}
