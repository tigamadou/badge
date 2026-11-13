export type DocAudience = "organisateur" | "staff" | "participant";
export const AUDIENCES: readonly DocAudience[] = ["organisateur", "staff", "participant"];

export interface DocFrontmatter {
  route: string;
  title: string;
  audience: DocAudience;
  /** Permission exigée par la garde de la page pour l'ouvrir (facultatif). */
  access?: string;
  sources: string[];
  sourceHash: string;
  updatedAt: string; // AAAA-MM-JJ
}

export interface ParsedDoc {
  frontmatter: Partial<DocFrontmatter>;
  body: string;
  /** Numéro (base 1) de la première ligne du corps dans le fichier. */
  bodyStartLine: number;
}

export interface BlockIssue {
  line: number;
  message: string;
}

const KEY_ORDER = ["route", "title", "audience", "access", "sources", "sourceHash", "updatedAt"] as const;
const FRONTMATTER_RE = /^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/;

function parseScalar(raw: string): string | null {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value.startsWith("'")) {
    return value.endsWith("'") && value.length >= 2 ? value.slice(1, -1).replace(/''/g, "'") : null;
  }
  return value.replace(/\s+#.*$/, "").trim();
}

function parseFrontmatter(block: string): Partial<DocFrontmatter> | null {
  const result: Record<string, string | string[]> = {};
  const lines = block.split("\n");
  let list: string[] | null = null;
  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (!list) return null;
      const value = parseScalar(item[1]);
      if (value === null) return null;
      list.push(value);
      continue;
    }
    const kv = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!kv) return null;
    list = null;
    const rest = (kv[2] ?? "").trim();
    if (rest === "") {
      list = [];
      result[kv[1]] = list;
    } else if (rest === "[]") {
      result[kv[1]] = [];
    } else {
      const value = parseScalar(rest);
      if (value === null) return null;
      result[kv[1]] = value;
    }
  }
  const known: Record<string, string | string[]> = {};
  for (const key of KEY_ORDER) if (key in result) known[key] = result[key];
  // Un scalaire vide (« access: ») est lu comme une liste vide : seule `sources` est une liste.
  for (const key of KEY_ORDER) {
    if (key !== "sources" && Array.isArray(known[key])) known[key] = "";
  }
  if ("sources" in known && !Array.isArray(known.sources)) known.sources = [known.sources];
  return known as Partial<DocFrontmatter>;
}

export function parseDoc(raw: string): ParsedDoc {
  const text = raw.replace(/\r\n/g, "\n");
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return { frontmatter: {}, body: text, bodyStartLine: 1 };
  const frontmatter = parseFrontmatter(match[1] ?? "");
  let rest = text.slice(match[0].length);
  let consumed = match[0].split("\n").length - (match[0].endsWith("\n") ? 1 : 0);
  if (rest.startsWith("\n")) {
    rest = rest.slice(1);
    consumed += 1;
  }
  if (!frontmatter) return { frontmatter: {}, body: rest, bodyStartLine: consumed + 1 };
  return { frontmatter, body: rest, bodyStartLine: consumed + 1 };
}

function scalar(value: string): string {
  const needsQuote = value === "" || /^[\s"'[\]{}&*!|>%@`?-]/.test(value) || /:(\s|$)/.test(value) || /\s#/.test(value) || /\s$/.test(value);
  return needsQuote ? JSON.stringify(value) : value;
}

export function serializeDoc(fm: DocFrontmatter, body: string): string {
  const lines: string[] = ["---"];
  for (const key of KEY_ORDER) {
    const value = fm[key];
    if (value === undefined) continue;
    if (key === "sources") {
      const sources = value as string[];
      if (sources.length === 0) lines.push("sources: []");
      else {
        lines.push("sources:");
        for (const s of sources) lines.push(`  - ${scalar(s)}`);
      }
    } else {
      lines.push(`${key}: ${scalar(value as string)}`);
    }
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n${body}`;
}

const OPEN_RE = /^:::permission(?:\s+(.*))?$/;

/** Vérifie les blocs `:::permission <clé>` … `:::` ; les lignes sont relatives au corps (base 1). */
export function validateBlocks(body: string, knownKeys: ReadonlySet<string>): BlockIssue[] {
  const issues: BlockIssue[] = [];
  let openedAt: number | null = null;
  body.split("\n").forEach((rawLine, index) => {
    const line = index + 1;
    const text = rawLine.trim();
    if (!text.startsWith(":::")) return;
    if (text === ":::") {
      if (openedAt === null) issues.push({ line, message: "« ::: » sans bloc ouvert" });
      else openedAt = null;
      return;
    }
    const open = OPEN_RE.exec(text);
    if (!open) {
      issues.push({ line, message: `bloc inconnu « ${text} » (seul « :::permission <clé> » existe)` });
      return;
    }
    if (openedAt !== null) issues.push({ line, message: "bloc imbriqué : fermez le bloc précédent avec « ::: »" });
    else openedAt = line;
    const key = (open[1] ?? "").trim();
    if (key === "") issues.push({ line, message: "clé de permission vide" });
    else if (!knownKeys.has(key)) issues.push({ line, message: `clé de permission inconnue « ${key} »` });
  });
  if (openedAt !== null) issues.push({ line: openedAt, message: "bloc non fermé (« ::: » manquant)" });
  return issues;
}

/** Clés des blocs `:::permission` du corps, avec leur ligne (relative au corps). */
export function blockKeys(body: string): { key: string; line: number }[] {
  const found: { key: string; line: number }[] = [];
  body.split("\n").forEach((rawLine, index) => {
    const open = OPEN_RE.exec(rawLine.trim());
    const key = (open?.[1] ?? "").trim();
    if (key) found.push({ key, line: index + 1 });
  });
  return found;
}
