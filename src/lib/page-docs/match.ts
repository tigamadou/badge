import { PAGE_DOC_INDEX } from "@/content/page-docs/index.generated";

// Appariement route -> doc, sans dépendance serveur : importable par le composant client (bouton « ? »).

export interface DocMatch {
  id: string;
  params: Record<string, string>;
}

const PARAM_VALUE_RE = /^[A-Za-z0-9_-]+$/;

interface Pattern {
  id: string;
  segments: string[];
  /** Clé de tri : un segment statique passe avant un segment dynamique à la même position. */
  rank: string;
}

const PATTERNS: Pattern[] = PAGE_DOC_INDEX.map((doc) => {
  const segments = doc.route.split("/").filter(Boolean);
  return { id: doc.id, segments, rank: segments.map((s) => (s.startsWith("[") ? "1" : "0")).join("") };
}).sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  if (pattern.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith("[")) {
      if (!PARAM_VALUE_RE.test(parts[i])) return null;
      params[pattern[i].slice(1, -1)] = parts[i];
    } else if (pattern[i] !== parts[i]) return null;
  }
  return params;
}

/** Doc correspondant à un chemin (query, hash et slash final tolérés) ; null s'il n'y en a pas. */
export function matchDocRoute(pathname: string): DocMatch | null {
  const path = pathname.split(/[?#]/)[0];
  if (!path.startsWith("/")) return null;
  const parts = path.split("/").filter(Boolean);
  for (const pattern of PATTERNS) {
    const params = matchSegments(pattern.segments, parts);
    if (params) return { id: pattern.id, params };
  }
  return null;
}
