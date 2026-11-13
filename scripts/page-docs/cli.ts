import path from "node:path";
import { checkDocs, type DocProblem } from "./check";
import { resolveSelectors, stampDocs } from "./stamp";

const TITLES: Record<DocProblem["kind"], string> = {
  missing: "Docs manquantes (page sans doc)",
  obsolete: "Docs obsolètes (sources modifiées)",
  orphan: "Docs orphelines (page absente)",
  format: "Erreurs de format",
  manifest: "Manifestes à régénérer",
};

export function formatProblems(problems: DocProblem[]): string {
  const lines: string[] = [];
  for (const kind of Object.keys(TITLES) as DocProblem["kind"][]) {
    const group = problems.filter((p) => p.kind === kind);
    if (group.length === 0) continue;
    lines.push(`${TITLES[kind]} : ${group.length}`);
    for (const p of group) lines.push(`  - ${p.target} : ${p.message}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Retourne le code de sortie. */
export function run(argv: string[], root: string, today: string, out: (line: string) => void): number {
  const [command, ...rest] = argv;
  if (command === "check") {
    const problems = checkDocs(root);
    if (problems.length === 0) {
      out("Docs des pages : tout est à jour.");
      return 0;
    }
    out(formatProblems(problems));
    out(`${problems.length} problème(s). Mettre à jour le texte puis \`make docs-stamp PAGES="<id>"\`.`);
    return 1;
  }
  if (command === "stamp") {
    if (rest.length === 0) {
      out('Usage : make docs-stamp PAGES="org/events/new platform" (identifiants, routes, espaces ou all)');
      return 1;
    }
    try {
      const stamped = stampDocs(root, resolveSelectors(root, rest), today);
      out(`${stamped.length} doc(s) tamponnée(s), manifestes réécrits.`);
      return 0;
    } catch (error) {
      out((error as Error).message);
      return 1;
    }
  }
  out("Usage : cli.ts check | stamp <sélecteurs…>");
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename ?? "")) {
  const root = path.resolve(__dirname, "../..");
  process.exitCode = run(process.argv.slice(2), root, new Date().toISOString().slice(0, 10), (l) => console.log(l));
}
