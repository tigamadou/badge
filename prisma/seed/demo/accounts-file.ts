import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_PASSWORD } from "../constants";
import type { DemoContext } from "./context";

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** Écrit le tableau Markdown des comptes de démo (email, rôle, cas) et rappelle le mot de passe commun. */
export async function writeAccountsFile(ctx: DemoContext, filePath: string): Promise<void> {
  const rows = ctx.accounts.map((a) => `| ${cell(a.email)} | ${cell(a.role)} | ${cell(a.scenario)} |`);
  const content = [
    "# Comptes de démonstration",
    "",
    `Mot de passe commun à tous les comptes : \`${DEMO_PASSWORD}\``,
    "",
    "| Email | Rôle | Cas |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
