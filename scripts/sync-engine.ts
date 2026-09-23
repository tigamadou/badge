import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

// Le moteur declaratif est une COPIE de pdfStudio/src/engine. Ce script est le
// seul chemin legitime pour la mettre a jour : le test de parite refuse toute
// edition faite sur place, ce qui est exactement le mode de divergence qui a
// joue jusqu'ici.
const TARGET = resolve("src/lib/badge-templates/engine");
// Fichiers produits ICI : ils ne viennent pas du studio et ne s'empreignent pas.
const GENERATED = ["ENGINE.sha256", "SOURCE.md"];

export function fingerprint(dir: string): string {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (!GENERATED.includes(relative(dir, full))) files.push(full);
    }
  };
  walk(dir);
  return files
    .map((file) => `${relative(dir, file)}  ${createHash("sha256").update(readFileSync(file)).digest("hex")}`)
    .join("\n");
}

function main(): void {
  const from = process.argv.includes("--from")
    ? process.argv[process.argv.indexOf("--from") + 1]
    : "../pdfStudio";
  const source = resolve(from, "src/engine");
  if (!existsSync(source)) throw new Error(`sync-engine : ${source} introuvable.`);

  // SOURCE.md consigne le commit HEAD : copier un src/engine modifie localement
  // produirait une copie qu'aucun commit ne decrit, donc introuvable plus tard.
  const dirty = execFileSync("git", ["-C", resolve(from), "status", "--porcelain", "--", "src/engine"])
    .toString()
    .trim();
  if (dirty) {
    console.error(
      `sync-engine : ${source} contient des modifications non commitees. Commiter (ou annuler) dans pdfStudio avant de synchroniser :\n${dirty}`,
    );
    process.exit(1);
  }

  const commit = execFileSync("git", ["-C", resolve(from), "rev-parse", "HEAD"]).toString().trim();

  rmSync(TARGET, { recursive: true, force: true });
  cpSync(source, TARGET, { recursive: true });

  writeFileSync(join(TARGET, "ENGINE.sha256"), `${fingerprint(TARGET)}\n`);
  writeFileSync(
    join(TARGET, "SOURCE.md"),
    `# Origine de ce dossier\n\nCopie de \`src/engine\` de pdfStudio, produite par \`scripts/sync-engine.ts\`.\n\n- Commit source : \`${commit}\`\n- Synchronise le : ${new Date().toISOString().slice(0, 10)}\n\nNe rien modifier ici : corriger dans pdfStudio, puis relancer \`make sync-engine\`.\n`,
  );
  console.log(`Moteur synchronise depuis ${source} (commit ${commit.slice(0, 8)}).`);
}

if (process.argv[1]?.endsWith("sync-engine.ts")) main();
