import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Empreinte sha256 des sources (triées, fins de ligne normalisées) ; un fichier absent compte comme absent. */
export function hashSources(root: string, sources: string[]): string {
  const h = crypto.createHash("sha256");
  for (const rel of [...sources].sort()) {
    let content: string;
    try {
      content = "present:" + fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
    } catch {
      content = "absent";
    }
    h.update(`${rel}\0${content}\0`);
  }
  return `sha256:${h.digest("hex")}`;
}
