import { join } from "node:path";
import { buildArchive } from "../scripts/pack-badge-template";
import { isValidTemplateName, writeManifest } from "./workshop";

export type PackResult = { ok: true; zip: Buffer } | { ok: false; errors: string[] };

// Enregistre le manifeste PUIS empaquette le dossier : l'archive reflete toujours
// ce qui est sur disque, et l'empaquetage reste celui de `make pack-badge-template`
// — un seul chemin de verite, donc aucun ecart possible entre les deux.
export async function packFromStudio(
  root: string,
  name: string,
  manifest: string,
): Promise<PackResult> {
  if (!isValidTemplateName(name)) return { ok: false, errors: [`Template inconnu : "${name}".`] };
  if (!(await writeManifest(root, name, manifest))) {
    return { ok: false, errors: [`Template inconnu : "${name}".`] };
  }

  try {
    return { ok: true, zip: await buildArchive(join(root, name)) };
  } catch (err) {
    // buildArchive leve avec la liste des erreurs de validation jointes.
    return { ok: false, errors: (err as Error).message.split("\n").map((line) => line.trim()) };
  }
}
