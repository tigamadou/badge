# Moteur v2 et liaisons de variables — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre un template conçu dans pdfStudio installable et utilisable directement dans l'application badge, en y portant le moteur déclaratif v2 et en y ajoutant une table de liaison entre variables déclarées et données métier.

**Architecture:** Le moteur de pdfStudio est **copié** dans `src/lib/badge-templates/engine/`, dossier scellé qu'un test d'empreinte interdit d'éditer sur place. Autour de lui, du code propre au badge : `bindings.ts` (le vocabulaire métier et sa validation), `build-values.ts` (TemplateContext + liaisons → VariableValues). Les liaisons sont choisies à l'installation sur un écran dédié et stockées en base ; les templates v1 déjà installés sont migrés par script, avec une table déduite par identité.

**Tech Stack:** Next.js (App Router), Prisma + MySQL, `@react-pdf/renderer`, Zod, Vitest (couverture 100 % imposée sur `src/lib/**` et `src/app/api/**`), Playwright pour l'e2e, stockage S3/MinIO.

**Spec:** `docs/v4/specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md`

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Copier le moteur et sceller le dossier | [ ] | | |
| 2 | `bindings.ts` — vocabulaire badge et validation | [ ] | | |
| 3 | `build-values.ts` — du contexte aux valeurs | [ ] | | |
| 4 | Colonne `bindings` en base | [ ] | | |
| 5 | ◆ Bascule — moteur v2, route d'installation à liaisons | [ ] | | |
| 6 | Route d'inspection et écran de liaison | [ ] | | |
| 7 | Migration des templates installés (script, en dev) | [ ] | | |
| 8 | Nettoyage et documentation | [ ] | | |
| — | Vérification finale | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettre à jour la ligne après chaque task validée (tests verts + critères d'acceptation) ; en cas d'interruption, passer à `[~]` et noter précisément l'état.

## Global Constraints

- **Aucun déploiement dans ce plan.** Le plan s'arrête sur la branche `development`, suite verte en local. Aucune commande `make prod-*`, `make preprod-*`, `make deploy`, `make upload`, ni connexion SSH. Le script de migration des lignes (tâche 7) ne s'exécute que contre la base **de dev**. La séquence de release décrite dans la spec (§ « Migration des lignes en base ») relève de l'utilisateur, hors plan.
- **Aucun commit sans demande explicite de l'utilisateur.** Les étapes « Point de commit » proposent un message ; elles ne valent pas autorisation. Pas de trailer ni de mention d'outil IA dans les messages.
- **`src/lib/badge-templates/engine/**` est scellé.** Il ne se modifie que par `scripts/sync-engine.ts`. Toute correction du moteur se fait **dans pdfStudio**, puis se resynchronise. Un agent qui veut « juste corriger une ligne » dans ce dossier doit s'arrêter et le signaler.
- **Couverture 100 %** (lignes, branches, fonctions, instructions) sur `src/lib/**` et `src/app/api/**`, `engine/**` excepté (exclusion posée en tâche 1). Un test manquant casse la CI.
- **Le dépôt pdfStudio doit être présent en `../pdfStudio`**, branche à jour : le portage copie l'état de `src/engine/` tel quel. Il est **lu** en tâche 1 (sync-engine), en tâche 5 (copie de `src/server/migrate-v1.ts`, comparaison de `templates/ex-305v`) et à la vérification finale (sync sans diff).
- **pdfStudio est hors de ce dépôt** : la seule écriture prévue là-bas (README, tâche 8, step 3) exige une **autorisation explicite de l'utilisateur** avant d'être faite, et ne se commite pas depuis ce dépôt.
- **Pas de `prisma/migrations`** dans ce dépôt : le schéma se pousse (`make db-push`, en dev).
- **Actions à demander avant** : `make db-reset` (destructif) et toute modification de `docker-compose*.yml`, `Dockerfile*`, `Caddyfile`, `.env*`.
- Les tests partagent une base MySQL unique, remise à zéro avant chaque test (`src/test-setup.ts`) et exécutés **séquentiellement** (`fileParallelism: false`). Ne jamais supposer une base vierge autrement.
- Commentaires **en français**, expliquant le *pourquoi*. C'est la norme du dépôt, y compris dans les fichiers copiés (ils viennent déjà ainsi).
- Les 15 sources du domaine badge, avec leur type, sont **exactement** celles de l'actuel `src/lib/badge-templates/declarative/sources.ts`. Ne pas en inventer, ne pas en retirer.
- Les commandes tournent dans le **conteneur de dev** (`make dev` au préalable ; la base de test y est joignable). Un fichier de test : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`. Vérification complète : `make lint && make typecheck && make test` ; couverture : `make test-coverage`. Seul `scripts/sync-engine.ts` tourne **sur l'hôte** (`npx tsx`), parce qu'il lit `../pdfStudio`, non monté dans le conteneur.

---

### Task 1: Copier le moteur et sceller le dossier

**Files:**
- Create: `scripts/sync-engine.ts`
- Create: `src/lib/badge-templates/engine/**` (copie)
- Create: `src/lib/badge-templates/__tests__/engine-parity.test.ts`
- Modify: `vitest.config.ts`
- Modify: `Makefile`

**Interfaces:**
- Consumes: rien.
- Produces: le dossier `engine/`, dont `engine/declarative/index.ts` exporte `buildDeclarativeTemplate(manifest, assets, templateId) -> DocumentTemplate`, `parseManifest(raw, entries) -> ParseResult`, `indexVariables`, `resolveVariable`, `samplesOf`, et les types `TemplateManifest`, `VariableDeclaration`, `VariableValues`, `VariableKind`, `Preset`, `AssetResolver`. `engine/types.ts` exporte `DocumentTemplate`, dont le `Component` prend `{ values: VariableValues }`.

- [ ] **Step 1: Écrire le script de synchronisation**

Créer `scripts/sync-engine.ts` :

```ts
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
```

- [ ] **Step 2: Exécuter la synchronisation**

```bash
npx tsx scripts/sync-engine.ts --from ../pdfStudio
ls src/lib/badge-templates/engine
```

Expected: le dossier contient `declarative/`, `__tests__/`, `format-date.ts`, `fonts.ts`, `package-reader.ts`, `px.ts`, `qrcode.ts`, `render-proof.tsx`, `types.ts`, plus `ENGINE.sha256` et `SOURCE.md`.

- [ ] **Step 3: Écrire le test de parité**

Créer `src/lib/badge-templates/__tests__/engine-parity.test.ts` :

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint } from "../../../../scripts/sync-engine";

const ENGINE = resolve("src/lib/badge-templates/engine");

describe("parite du moteur", () => {
  it("aucun fichier du moteur n'a ete modifie hors sync-engine", () => {
    const recorded = readFileSync(resolve(ENGINE, "ENGINE.sha256"), "utf8").trim();
    // Un echec ici ne se corrige JAMAIS en regenerant l'empreinte : il veut dire
    // qu'on a edite la copie. Le correctif va dans pdfStudio, puis `make sync-engine`.
    expect(fingerprint(ENGINE)).toBe(recorded);
  });
});
```

- [ ] **Step 4: Lancer le test**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/engine-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Exclure `engine/` de la couverture**

Dans `vitest.config.ts`, ajouter à `coverage.exclude`, après l'entrée `src/lib/badge-templates/**/types.ts` :

```ts
        // Le moteur est une COPIE scellee de pdfStudio (scripts/sync-engine.ts) :
        // personne ne peut y ajouter la ligne de test manquante sans faire echouer
        // le test de parite. Ses propres tests tournent et gardent leur valeur de
        // non-regression, mais le seuil de ce depot ne s'y applique pas.
        "src/lib/badge-templates/engine/**",
```

- [ ] **Step 6: Ajouter la cible Makefile**

Dans la liste `.PHONY` puis dans le corps du `Makefile` :

```make
# Resynchronise le moteur declaratif depuis pdfStudio (voir engine/SOURCE.md).
sync-engine:
	npx tsx scripts/sync-engine.ts --from ../pdfStudio
```

- [ ] **Step 7: Vérifier que rien n'est cassé**

Run: `make test`
Expected: PASS — les tests du moteur portés s'exécutent maintenant en plus des anciens. **Si un test porté échoue, ne pas le corriger sur place** : le noter et le remonter, c'est un signal que la copie ne tourne pas dans les mêmes conditions que chez elle.

- [ ] **Step 8: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add scripts/sync-engine.ts src/lib/badge-templates/engine src/lib/badge-templates/__tests__/engine-parity.test.ts vitest.config.ts Makefile
git commit -m "feat(moteur): copie scellee du moteur v2 de pdfStudio"
```

---

### Task 2: `bindings.ts` — le vocabulaire badge et sa validation

**Files:**
- Create: `src/lib/badge-templates/bindings.ts`
- Test: `src/lib/badge-templates/__tests__/bindings.test.ts`

**Interfaces:**
- Consumes: `VariableDeclaration`, `VariableKind` depuis `./engine/declarative/manifest-types`.
- Produces:
  - `SOURCE_KINDS: Record<string, VariableKind>` — les 15 sources.
  - `Bindings = Record<string, string | null>`.
  - `validateBindings(variables: VariableDeclaration[], bindings: Bindings): string[]`.
  - `suggestBindings(variables: VariableDeclaration[]): Bindings`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/badge-templates/__tests__/bindings.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { SOURCE_KINDS, suggestBindings, validateBindings } from "../bindings";
import type { VariableDeclaration } from "../engine/declarative/manifest-types";

const variables: VariableDeclaration[] = [
  { name: "prenom", kind: "text", label: "Prenom" },
  { name: "photo", kind: "image", label: "Photo" },
  { name: "estAnonyme", kind: "boolean", label: "Anonyme" },
];

describe("SOURCE_KINDS", () => {
  it("expose les quinze sources du domaine badge", () => {
    expect(Object.keys(SOURCE_KINDS)).toHaveLength(15);
    expect(SOURCE_KINDS["participant.firstName"]).toBe("text");
    expect(SOURCE_KINDS["category.color"]).toBe("color");
    expect(SOURCE_KINDS["event.date"]).toBe("date");
    expect(SOURCE_KINDS["badge.qrCodeDataUrl"]).toBe("image");
  });
});

describe("validateBindings", () => {
  it("accepte une table complete et bien typee", () => {
    expect(
      validateBindings(variables, {
        prenom: "participant.firstName",
        photo: "participant.photoDataUrl",
        estAnonyme: "category.anonymous",
      }),
    ).toEqual([]);
  });

  it("accepte une variable explicitement laissee vide", () => {
    expect(
      validateBindings(variables, {
        prenom: "participant.firstName",
        photo: null,
        estAnonyme: "category.anonymous",
      }),
    ).toEqual([]);
  });

  it("refuse une variable dont la liaison n'a pas ete decidee", () => {
    const errors = validateBindings(variables, { prenom: "participant.firstName" });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("photo");
    expect(errors[0]).toContain("aucune source choisie");
  });

  it("refuse une source inconnue", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.nickname",
      photo: null,
      estAnonyme: null,
    });
    expect(errors).toEqual([
      'variable "prenom" : source inconnue "participant.nickname".',
    ]);
  });

  it("refuse une source dont le type ne correspond pas", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.firstName",
      photo: "participant.firstName",
      estAnonyme: null,
    });
    expect(errors).toEqual([
      'variable "photo" (image) : la source "participant.firstName" est de type text.',
    ]);
  });

  it("signale une liaison qui ne correspond a aucune variable declaree", () => {
    const errors = validateBindings(variables, {
      prenom: "participant.firstName",
      photo: null,
      estAnonyme: null,
      fantome: "event.title",
    });
    expect(errors).toEqual(['liaison "fantome" : aucune variable de ce nom.']);
  });
});

describe("suggestBindings", () => {
  it("propose l'identite quand le nom est une source du meme type", () => {
    const declared: VariableDeclaration[] = [
      { name: "participant.firstName", kind: "text", label: "Prenom" },
      { name: "event.date", kind: "date", label: "Date" },
    ];
    expect(suggestBindings(declared)).toEqual({
      "participant.firstName": "participant.firstName",
      "event.date": "event.date",
    });
  });

  it("ne propose rien pour un nom libre", () => {
    expect(suggestBindings(variables)).toEqual({});
  });

  it("ne propose rien quand le nom correspond mais pas le type", () => {
    const declared: VariableDeclaration[] = [
      { name: "participant.firstName", kind: "image", label: "Prenom" },
    ];
    expect(suggestBindings(declared)).toEqual({});
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/bindings.test.ts`
Expected: FAIL — `Cannot find module '../bindings'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/lib/badge-templates/bindings.ts` :

```ts
import type { VariableDeclaration, VariableKind } from "./engine/declarative/manifest-types";

// Le vocabulaire du domaine badge. Il vivait dans le moteur (declarative/sources.ts) ;
// le moteur v2 ne connait plus aucun nom metier, alors il remonte ici — hors du
// dossier copie, dans le code dont l'application est proprietaire.
export const SOURCE_KINDS: Record<string, VariableKind> = {
  "participant.firstName": "text",
  "participant.lastName": "text",
  "participant.structure": "text",
  "participant.photoDataUrl": "image",
  "category.name": "text",
  "category.color": "color",
  "category.neutralBadge": "boolean",
  "category.anonymous": "boolean",
  "event.title": "text",
  "event.date": "date",
  "event.location": "text",
  "event.logoDataUrl": "image",
  "badge.id": "text",
  "badge.verifyUrl": "text",
  "badge.qrCodeDataUrl": "image",
};

// Nom de variable -> chemin de source, ou null pour « laisser vide ». L'ABSENCE
// de cle n'est pas un choix : c'est une variable dont personne n'a decide, et
// c'est une erreur. Une variable non liee s'imprimerait vide sans que quiconque
// l'ait voulu.
export type Bindings = Record<string, string | null>;

export function validateBindings(
  variables: VariableDeclaration[],
  bindings: Bindings,
): string[] {
  const errors: string[] = [];
  const declared = new Set(variables.map((variable) => variable.name));

  for (const variable of variables) {
    if (!(variable.name in bindings)) {
      errors.push(`variable "${variable.name}" : aucune source choisie.`);
      continue;
    }
    const source = bindings[variable.name];
    if (source === null) continue;

    const kind = SOURCE_KINDS[source];
    if (!kind) {
      errors.push(`variable "${variable.name}" : source inconnue "${source}".`);
      continue;
    }
    if (kind !== variable.kind) {
      errors.push(
        `variable "${variable.name}" (${variable.kind}) : la source "${source}" est de type ${kind}.`,
      );
    }
  }

  for (const name of Object.keys(bindings)) {
    if (!declared.has(name)) errors.push(`liaison "${name}" : aucune variable de ce nom.`);
  }

  return errors;
}

// Pre-remplissage de l'ecran d'installation : l'identite, et rien de plus. Une
// heuristique sur les noms proches (« prenom » -> participant.firstName) produirait
// des suggestions fausses qu'on validerait d'un clic — pire qu'une case vide.
export function suggestBindings(variables: VariableDeclaration[]): Bindings {
  const suggested: Bindings = {};
  for (const variable of variables) {
    if (SOURCE_KINDS[variable.name] === variable.kind) suggested[variable.name] = variable.name;
  }
  return suggested;
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/bindings.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add src/lib/badge-templates/bindings.ts src/lib/badge-templates/__tests__/bindings.test.ts
git commit -m "feat(templates): vocabulaire badge et validation des liaisons"
```

---

### Task 3: `build-values.ts` — du contexte aux valeurs de variables

**Files:**
- Create: `src/lib/badge-templates/build-values.ts`
- Test: `src/lib/badge-templates/__tests__/build-values.test.ts`

**Interfaces:**
- Consumes: `Bindings` (tâche 2) ; `TemplateContext` de `./types` ; `VariableDeclaration`, `VariableValues` de `./engine/declarative/manifest-types`.
- Produces: `buildValues(ctx: TemplateContext, variables: VariableDeclaration[], bindings: Bindings): VariableValues`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/badge-templates/__tests__/build-values.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildValues } from "../build-values";
import type { TemplateContext } from "../types";
import type { VariableDeclaration } from "../engine/declarative/manifest-types";

const ctx: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    structure: "Organisation",
    photoDataUrl: "data:image/png;base64,AAA",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: {
    title: "Forum",
    date: new Date("2027-12-15T00:00:00.000Z"),
    location: "Cotonou",
    logoDataUrl: null,
  },
  badge: { id: "DEMO-1", verifyUrl: "https://badge.local/verify/DEMO-1", qrCodeDataUrl: "data:image/png;base64,BBB" },
};

const declare = (name: string, kind: VariableDeclaration["kind"]): VariableDeclaration => ({
  name,
  kind,
  label: name,
});

describe("buildValues", () => {
  it("lit chaque variable par sa source", () => {
    const values = buildValues(ctx, [declare("prenom", "text"), declare("couleur", "color")], {
      prenom: "participant.firstName",
      couleur: "category.color",
    });
    expect(values).toEqual({ prenom: "Awa", couleur: "#4f46e5" });
  });

  it("passe une date en ISO, sans la formater", () => {
    // Le format appartient desormais au manifeste : resolveVariable l'applique.
    const values = buildValues(ctx, [declare("dateEvent", "date")], { dateEvent: "event.date" });
    expect(values.dateEvent).toBe("2027-12-15T00:00:00.000Z");
  });

  it("garde les booleens tels quels", () => {
    const values = buildValues(ctx, [declare("anonyme", "boolean")], { anonyme: "category.anonymous" });
    expect(values.anonyme).toBe(true);
  });

  it("n'ecrit rien pour une variable laissee vide", () => {
    // Rien d'ecrit => resolveVariable rend le vide du type => isEmpty joue, et les
    // blocs de repli fonctionnent sans code supplementaire.
    const values = buildValues(ctx, [declare("mention", "text")], { mention: null });
    expect(values).toEqual({});
    expect("mention" in values).toBe(false);
  });

  it("n'ecrit rien pour une variable absente de la table", () => {
    expect(buildValues(ctx, [declare("mention", "text")], {})).toEqual({});
  });

  it("rend une chaine vide pour un logo absent", () => {
    const values = buildValues(ctx, [declare("logo", "image")], { logo: "event.logoDataUrl" });
    expect(values.logo).toBe("");
  });

  it("leve sur une source inconnue", () => {
    // Garde defensive : validateBindings a deja refuse ce cas a l'installation.
    expect(() =>
      buildValues(ctx, [declare("x", "text")], { x: "participant.nickname" }),
    ).toThrow('buildValues : source inconnue "participant.nickname"');
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/build-values.test.ts`
Expected: FAIL — `Cannot find module '../build-values'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/lib/badge-templates/build-values.ts` :

```ts
import type { Bindings } from "./bindings";
import type { TemplateContext } from "./types";
import type { VariableDeclaration, VariableValues } from "./engine/declarative/manifest-types";

// Table explicite plutot qu'un acces dynamique par split(".") : le compilateur
// verifie chaque acces, et une source retiree du contexte devient une erreur de
// typage au lieu d'un undefined a l'execution.
//
// Difference avec l'ancien resolve-source : on lit BRUT. `event.date` sort en Date
// et le formatage appartient au manifeste, via le `format` de la variable.
const READERS: Record<string, (c: TemplateContext) => string | boolean | Date> = {
  "participant.firstName": (c) => c.participant.firstName,
  "participant.lastName": (c) => c.participant.lastName,
  "participant.structure": (c) => c.participant.structure,
  "participant.photoDataUrl": (c) => c.participant.photoDataUrl,
  "category.name": (c) => c.category.name,
  "category.color": (c) => c.category.color,
  "category.neutralBadge": (c) => c.category.neutralBadge,
  "category.anonymous": (c) => c.category.anonymous,
  "event.title": (c) => c.event.title,
  "event.date": (c) => c.event.date,
  "event.location": (c) => c.event.location,
  "event.logoDataUrl": (c) => c.event.logoDataUrl ?? "",
  "badge.id": (c) => c.badge.id,
  "badge.verifyUrl": (c) => c.badge.verifyUrl,
  "badge.qrCodeDataUrl": (c) => c.badge.qrCodeDataUrl,
};

export function buildValues(
  ctx: TemplateContext,
  variables: VariableDeclaration[],
  bindings: Bindings,
): VariableValues {
  const values: VariableValues = {};

  for (const variable of variables) {
    const source = bindings[variable.name];
    // Absente ou nulle : on n'ecrit rien, et le moteur rendra le vide du type.
    if (!source) continue;

    const read = READERS[source];
    if (!read) throw new Error(`buildValues : source inconnue "${source}"`);

    const raw = read(ctx);
    values[variable.name] = raw instanceof Date ? raw.toISOString() : raw;
  }

  return values;
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/__tests__/build-values.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add src/lib/badge-templates/build-values.ts src/lib/badge-templates/__tests__/build-values.test.ts
git commit -m "feat(templates): valeurs de variables derivees du contexte et des liaisons"
```

---

### Task 4: La colonne `bindings` en base

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: rien.
- Produces: `InstalledBadgeTemplate.bindings` — un `Json` valant `{}` par défaut, lu par les tâches 5 et 6.

- [ ] **Step 1: Ajouter la colonne**

Dans `model InstalledBadgeTemplate`, sous `layout Json`, ajouter :

```prisma
  // Table de liaison choisie a l'installation : nom de variable du manifeste ->
  // chemin de source du domaine badge, ou null pour « laisser vide ». Le manifeste
  // v2 declare des variables aux noms libres et ne dit pas d'ou vient une valeur :
  // c'est ici que l'application le dit. Defaut {} : une ligne migree depuis la v1
  // la recoit par script (scripts/migrate-installed-templates-v2.ts).
  bindings      Json      @default("{}")
```

- [ ] **Step 2: Pousser le schéma et régénérer le client**

```bash
make db-push
```

Expected: la colonne est créée et le client Prisma régénéré (le Makefile le fait aussi sur l'hôte pour les types de l'IDE).

- [ ] **Step 3: Vérifier que la suite passe toujours**

Run: `make test`
Expected: PASS — la colonne est additive, rien ne la lit encore.

- [ ] **Step 4: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add prisma/schema.prisma
git commit -m "feat(bdd): table de liaison des variables sur un template installe"
```

---

### Task 5: ◆ Bascule — le moteur v2 remplace le v1

**Files:**
- Modify: `src/lib/badge-templates/types.ts`, `resolve.ts`, `install.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx`
- Modify: `src/app/api/platform/badge-templates/route.ts` et `src/app/api/platform/badge-templates/__tests__/route.test.ts`
- Create: `src/lib/badge-templates/migrate-v1.ts` (porté de pdfStudio)
- Modify: `prisma/badge-templates/{default,recto-verso}/manifest.json`, `badge-templates/ex-305v/manifest.json`
- Create: `prisma/badge-templates/{default,recto-verso}/bindings.json`
- Delete: `src/lib/badge-templates/declarative/` (tout le dossier), `fonts.ts`, `package-reader.ts`, `px.ts`, `render-proof.tsx` et leurs tests
- Test: `src/lib/badge-templates/__tests__/{resolve.test.tsx,install.test.ts,reference-packages.test.ts}`, `src/app/api/platform/badge-templates/[id]/__tests__/route.test.ts` (fixture v2)

**Interfaces:**
- Consumes: `engine/` (tâche 1) ; `Bindings`, `validateBindings` (tâche 2) ; `buildValues` (tâche 3) ; la colonne `bindings` (tâche 4).
- Produces: `BadgeTemplate` = `{ meta, variables: VariableDeclaration[], bindings: Bindings, Component: ComponentType<{ values: VariableValues }> }` ; `installTemplate({ manifest, assets, bindings, installedById })` avec `bindings` **obligatoire** ; `readReferencePackage(family)` rend en plus `bindings` ; `migrateManifest(input, entries)` et `V1_VARIABLES`, réutilisés par la tâche 7 ; `POST /api/platform/badge-templates` exige un champ de formulaire `bindings` (JSON sérialisé), consommé par l'écran de la tâche 6.

**Cette tâche est volontairement grosse : elle ne se découpe pas.** Dès qu'un fichier pointe vers `engine/`, il reçoit un schéma v2 qui refuse les manifestes v1 et un `Component` qui prend `values` — le dépôt ne compile et ne passe ses tests qu'une fois la bascule entière faite. La route d'installation en fait partie : c'est l'appelant de `installTemplate`, elle ne compile plus sans `bindings`. Ne pas commiter à mi-chemin.

**État connu entre la tâche 5 et la tâche 6** : l'API d'installation exige `bindings`, mais `BadgeTemplateInstaller.tsx` ne l'envoie pas encore. Le téléversement depuis l'interface répond donc 400 (« liaisons : champ manquant. ») et le scénario de téléversement de `e2e/platform/badge-templates.spec.ts` est rouge jusqu'à la tâche 6. C'est attendu ; la suite Vitest, elle, doit être verte.

- [ ] **Step 1: Réorienter les imports vers `engine/`**

Lister les fichiers concernés :

```bash
grep -rln "badge-templates/declarative\|badge-templates/package-reader\|badge-templates/px\|badge-templates/render-proof\|badge-templates/fonts" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Chaque `@/lib/badge-templates/<module>` devient `@/lib/badge-templates/engine/<module>` ; chaque `./declarative/...` devient `./engine/declarative/...`. Cela touche `install.ts`, `resolve.ts`, les routes `platform/badge-templates`, `scripts/pack-badge-template.ts` et les tests.

- [ ] **Step 2: Supprimer les doublons et le domaine badge du moteur**

```bash
git rm -r src/lib/badge-templates/declarative
git rm src/lib/badge-templates/fonts.ts src/lib/badge-templates/package-reader.ts \
       src/lib/badge-templates/px.ts src/lib/badge-templates/render-proof.tsx
git rm src/lib/badge-templates/__tests__/px.test.ts \
       src/lib/badge-templates/__tests__/package-reader.test.ts \
       src/lib/badge-templates/__tests__/render-proof.test.ts
```

`sources.ts`, `resolve-source.ts`, `sample-context.ts` et `resolve-source.test.ts` partent avec le dossier `declarative/`.

- [ ] **Step 3: Adapter le contrat de `BadgeTemplate`**

Dans `src/lib/badge-templates/types.ts`, remplacer :

```ts
export type BadgeTemplate = {
  meta: TemplateMeta;
  Component: ComponentType<{ ctx: TemplateContext }>;
};
```

par :

```ts
import type { VariableDeclaration, VariableValues } from "./engine/declarative/manifest-types";
import type { Bindings } from "./bindings";

// Le moteur ne sait plus ce qu'est un badge : il rend un document sur un
// dictionnaire de valeurs. L'application y joint ce qu'il faut pour le remplir —
// les variables declarees et la table de liaison choisie a l'installation.
export type BadgeTemplate = {
  meta: TemplateMeta;
  variables: VariableDeclaration[];
  bindings: Bindings;
  Component: ComponentType<{ values: VariableValues }>;
};
```

`TemplateContext` reste dans ce fichier, inchangé : c'est lui qu'alimente `build-context.ts`.

- [ ] **Step 4: Adapter `resolve.ts`**

Ajouter les imports `validateBindings` et `type Bindings` depuis `./bindings`, puis remplacer `buildFromRow` :

```ts
async function buildFromRow(row: InstalledBadgeTemplate): Promise<BadgeTemplate> {
  const manifest = row.layout as unknown as TemplateManifest;
  const bindings = (row.bindings ?? {}) as Bindings;
  const assets = await loadAssetResolver(row);
  const template = buildDeclarativeTemplate(manifest, assets, row.id);

  // Une table imparfaite ne doit JAMAIS empecher un badge de s'imprimer : l'ecran
  // d'installation et le script de migration garantissent la completude en amont,
  // ce journal n'est la que pour attraper la derive.
  const errors = validateBindings(manifest.variables, bindings);
  if (errors.length > 0) {
    console.warn(`[badge-templates] liaisons incompletes pour "${row.id}" : ${errors.join(" | ")}`);
  }

  return {
    ...template,
    variables: manifest.variables,
    bindings,
    meta: { ...template.meta, previewSrc: previewUrl(row.previewPath) },
  };
}
```

- [ ] **Step 5: Adapter la route de rendu d'un badge**

Dans `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx`, ajouter :

```tsx
import { buildValues } from "@/lib/badge-templates/build-values";
```

puis, après la construction du contexte, remplacer le rendu :

```tsx
    const values = buildValues(templateCtx, template.variables, template.bindings);
    const stream = await renderToStream(<Component values={values} />);
```

- [ ] **Step 6: Exiger une table de liaison à l'installation**

Dans `src/lib/badge-templates/install.ts`, ajouter :

```ts
import { validateBindings, type Bindings } from "./bindings";
```

Changer la signature et poser la garde en tête :

```ts
export async function installTemplate(args: {
  manifest: TemplateManifest;
  assets: PackageAsset[];
  bindings: Bindings;
  installedById: string;
}): Promise<InstallResult> {
  const { manifest, assets, bindings, installedById } = args;

  // Un paquet dont les variables ne sont pas toutes decidees n'entre pas au
  // catalogue : la route et le seed ont deja eu l'occasion de le completer.
  const errors = validateBindings(manifest.variables, bindings);
  if (errors.length > 0) {
    throw new Error(`installTemplate : liaisons invalides — ${errors.join(" | ")}`);
  }
```

Dans le `prisma.installedBadgeTemplate.create`, ajouter au `data`, après `layout` :

```ts
      bindings: bindings as unknown as object,
```

- [ ] **Step 7: Lire `bindings.json` pour les paquets livrés**

Toujours dans `install.ts`, dans `readReferencePackage`, après la lecture du manifeste :

```ts
  // Les paquets livres avec l'application portent leur table de liaison en depot :
  // le seed n'a pas d'administrateur devant lui pour la choisir. C'est CE depot qui
  // l'ecrit, pour ses propres paquets — pdfStudio n'en produit pas.
  const bindings = JSON.parse(readFileSync(join(dir, "bindings.json"), "utf8")) as Bindings;
```

Élargir le type de retour en `{ manifest: TemplateManifest; assets: PackageAsset[]; bindings: Bindings }`, ajouter `bindings` à l'objet rendu, et dans `ensureReferenceTemplates` :

```ts
    const { manifest, assets, bindings } = readReferencePackage(family);
    await installTemplate({ manifest, assets, bindings, installedById });
```

- [ ] **Step 8: Porter le module de migration de format**

```bash
cp ../pdfStudio/src/server/migrate-v1.ts src/lib/badge-templates/migrate-v1.ts
```

Corriger l'unique import en tête du fichier :

```ts
import type { VariableDeclaration } from "./engine/declarative/manifest-types";
```

Ce fichier porte du vocabulaire badge : il vit **hors** de `engine/` et n'est donc pas couvert par le test de parité. Il sert ici pour les manifestes du dépôt, et en tâche 7 pour les lignes en base.

- [ ] **Step 9: Migrer les trois manifestes du dépôt**

```bash
npx tsx -e '
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { migrateManifest } from "./src/lib/badge-templates/migrate-v1";
for (const dir of ["prisma/badge-templates/default", "prisma/badge-templates/recto-verso", "badge-templates/ex-305v"]) {
  const raw = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
  const entries = existsSync(`${dir}/assets`) ? readdirSync(`${dir}/assets`).map((f) => `assets/${f}`) : [];
  const { manifest, notes } = migrateManifest(raw, entries);
  writeFileSync(`${dir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(dir, notes);
}'
```

Les notes signaleront les samples d'images absents des paquets : c'est attendu et sans effet sur les badges réels (voir la spec).

Comparer ensuite `ex-305v` avec la version éprouvée dans le studio et reprendre celle-ci si elle diffère :

```bash
diff badge-templates/ex-305v/manifest.json ../pdfStudio/templates/ex-305v/manifest.json
```

Ce paquet est hors `REFERENCE_DIR` : il n'a pas besoin de `bindings.json`.

- [ ] **Step 10: Écrire les deux `bindings.json`**

Les manifestes migrés déclarent les 15 variables v1, nommées exactement comme les sources : la table est l'identité. Même contenu pour `prisma/badge-templates/default/bindings.json` et `prisma/badge-templates/recto-verso/bindings.json` :

```json
{
  "participant.firstName": "participant.firstName",
  "participant.lastName": "participant.lastName",
  "participant.structure": "participant.structure",
  "participant.photoDataUrl": "participant.photoDataUrl",
  "category.name": "category.name",
  "category.color": "category.color",
  "category.neutralBadge": "category.neutralBadge",
  "category.anonymous": "category.anonymous",
  "event.title": "event.title",
  "event.date": "event.date",
  "event.location": "event.location",
  "event.logoDataUrl": "event.logoDataUrl",
  "badge.id": "badge.id",
  "badge.verifyUrl": "badge.verifyUrl",
  "badge.qrCodeDataUrl": "badge.qrCodeDataUrl"
}
```

- [ ] **Step 11: Adapter les tests existants**

**Fixtures v1 à passer en v2.** Le schéma v2 refuse `formatVersion: 1` : tout fixture de manifeste encore en v1 dans les tests restants doit être réécrit. La liste exhaustive (hors fichiers supprimés au step 2 et hors `scripts/new-badge-template.ts`, retiré en tâche 8) :

```bash
grep -rlnE 'formatVersion"?: ?1' src scripts e2e | grep -v node_modules
```

- `src/app/api/platform/badge-templates/__tests__/route.test.ts` (`manifestOf`)
- `src/app/api/platform/badge-templates/[id]/__tests__/route.test.ts` (`LAYOUT`, et le `formatVersion: 1` de la ligne créée → `2`)
- `src/lib/badge-templates/__tests__/install.test.ts`
- `src/lib/badge-templates/__tests__/resolve.test.tsx`

(`e2e/platform/badge-templates.spec.ts` se traite en tâche 6, avec le parcours de liaison.)

Forme v2 de référence — elle déclare ses variables, et le texte n'utilise que des variables déclarées. Une variable au nom de source (suggérée par identité) et une au nom libre (à lier à la main) couvrent les deux cas de l'écran de liaison :

```ts
function manifestOf(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 2,
    family: "salon-2027",
    label: "Badge Salon",
    description: "Un badge de test.",
    page: { widthPx: 1011, heightPx: 638, count: 1 },
    variables: [
      { name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" },
      { name: "structure", kind: "text", label: "Structure", sample: "Organisation" },
    ],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 4,
        y: 4,
        w: 400,
        h: 60,
        text: "{participant.firstName} — {structure}",
        style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
      },
    ],
    ...overrides,
  };
}

// Table de liaison complete pour ce fixture.
const BINDINGS = { "participant.firstName": "participant.firstName", structure: "participant.structure" };
```

Si un fixture existant exerce une fonctionnalité précise (ressource, police, plusieurs pages), garder ses blocs et n'ajouter que `formatVersion: 2` et les `variables` qu'ils référencent. Les erreurs de `parseManifest` nomment la variable manquante.

Dans `src/lib/badge-templates/__tests__/resolve.test.tsx`, remplacer les rendus `<Component ctx={…} />` par `<Component values={…} />` et ajouter :

```tsx
  it("journalise une table de liaison incomplete sans echouer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Ligne installee puis videe de ses liaisons : on veut un badge imprime et
    // un avertissement, jamais une exception.
    await prisma.installedBadgeTemplate.update({ where: { id }, data: { bindings: {} } });
    const template = await resolveTemplate(id);
    expect(template.bindings).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("liaisons incompletes"));
    warn.mockRestore();
  });
```

Dans `src/lib/badge-templates/__tests__/install.test.ts`, compléter **tous** les appels à `installTemplate` avec une table complète pour le manifeste passé (`BINDINGS` pour le fixture v2 du début de ce step) et ajouter :

```ts
  it("refuse une table de liaison incomplete", async () => {
    await expect(
      installTemplate({ manifest, assets: [], bindings: {}, installedById: user.id }),
    ).rejects.toThrow(/aucune source choisie/);
  });

  it("stocke la table de liaison", async () => {
    const bindings = Object.fromEntries(manifest.variables.map((v) => [v.name, null]));
    const created = await installTemplate({ manifest, assets: [], bindings, installedById: user.id });
    const row = await prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.bindings).toEqual(bindings);
  });
```

Dans `src/lib/badge-templates/__tests__/reference-packages.test.ts`, ajouter pour chaque famille :

```ts
    it(`${family} : sa table de liaison est valide`, () => {
      const bindings = JSON.parse(
        readFileSync(resolve(REFERENCE_DIR, family, "bindings.json"), "utf8"),
      );
      expect(validateBindings(parsed.manifest.variables, bindings)).toEqual([]);
    });
```

- [ ] **Step 12: Faire accepter les liaisons à la route d'installation**

Dans `src/app/api/platform/badge-templates/route.ts`, ajouter l'import :

```ts
import { validateBindings, type Bindings } from "@/lib/badge-templates/bindings";
```

Après `const { manifest, assets } = read;`, ajouter la lecture et la validation :

```ts
  const raw = form?.get("bindings");
  if (typeof raw !== "string") {
    return badRequest(["liaisons : champ manquant."]);
  }
  let bindings: Bindings;
  try {
    bindings = JSON.parse(raw) as Bindings;
  } catch {
    return badRequest(["liaisons : JSON illisible."]);
  }
  // Refus avec la liste COMPLETE des erreurs : l'ecran de liaison les affiche
  // toutes d'un coup, plutot qu'une par tentative.
  const bindingErrors = validateBindings(manifest.variables, bindings);
  if (bindingErrors.length > 0) return badRequest(bindingErrors);
```

Puis passer `bindings` à l'appel `installTemplate({ manifest, assets, bindings, installedById: … })`.

Dans `src/app/api/platform/badge-templates/__tests__/route.test.ts`, faire poser par `requestWith` un champ `bindings` valant `JSON.stringify(BINDINGS)` (le fixture v2 du step 11), avec un second paramètre optionnel pour le remplacer, puis ajouter les trois refus :

```ts
  it("refuse une installation sans champ de liaisons", async () => {
    const form = new FormData();
    form.set("archive", new File([archive], "t.zip"));
    const res = await POST(new NextRequest("http://localhost/api/platform/badge-templates", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["liaisons : champ manquant."]);
  });

  it("refuse des liaisons illisibles", async () => {
    const form = new FormData();
    form.set("archive", new File([archive], "t.zip"));
    form.set("bindings", "{pas du json");
    const res = await POST(new NextRequest("http://localhost/api/platform/badge-templates", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["liaisons : JSON illisible."]);
  });

  it("refuse une installation dont les liaisons sont incompletes", async () => {
    const form = new FormData();
    form.set("archive", new File([archive], "t.zip"));
    form.set("bindings", JSON.stringify({}));
    const res = await POST(new NextRequest("http://localhost/api/platform/badge-templates", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors[0]).toContain("aucune source choisie");
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });
```

Les trois branches ajoutées sont couvertes : le seuil de 100 % sur `src/app/api/**` tient.

- [ ] **Step 13: Vérifier**

Run: `make lint && make typecheck && make test`
Expected: PASS des trois. **C'est ici que la bascule se valide** : si la suite passe, l'application rend désormais par le moteur v2. Puis `make test-coverage` : 100 % hors `engine/`.

- [ ] **Step 14: Recharger la base et regarder un badge**

`make db-reset` est **destructif** : demander l'accord de l'utilisateur avant de le lancer. S'il refuse : la base de dev garde ses lignes v1, que le moteur v2 ne sait plus rendre ; reporter ce contrôle visuel après la tâche 7 (migration `--apply` en dev) et le noter dans la Progression.

```bash
make db-reset   # uniquement avec l'accord explicite de l'utilisateur ; enchaine deja le seed
```

Ouvrir un badge d'une inscription de démonstration : il doit s'imprimer comme avant. Ne pas vérifier le téléversement ici : il attend la tâche 6.

- [ ] **Step 15: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add -A src/lib/badge-templates src/app/api prisma/badge-templates badge-templates scripts
git commit -m "feat(rendu): bascule sur le moteur v2, rendu par dictionnaire de valeurs"
```

---

### Task 6: Route d'inspection et écran de liaison

**Files:**
- Create: `src/app/api/platform/badge-templates/inspect/route.ts`
- Create: `src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
- Modify: `src/components/staff/BadgeTemplateInstaller.tsx`
- Modify: `e2e/platform/badge-templates.spec.ts`

**Interfaces:**
- Consumes: `SOURCE_KINDS`, `suggestBindings`, `Bindings` (tâche 2) ; `POST /api/platform/badge-templates` avec son champ `bindings` obligatoire (tâche 5) ; `readTemplatePackage`, `MAX_ARCHIVE_BYTES` de `@/lib/badge-templates/engine/package-reader`.
- Produces: `POST /api/platform/badge-templates/inspect` → `{ variables: VariableDeclaration[], suggested: Bindings, sources: Record<string, VariableKind> }`.

- [ ] **Step 1: Écrire le test de la route d'inspection**

Créer `src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`. En-tête identique au fichier voisin `src/app/api/platform/badge-templates/__tests__/route.test.ts` : copier tels quels ses imports, le `vi.mock("next-auth", …)`, `withSession`, `noSession`, `makeStaff`, `PNG`, `archiveOf`, ainsi que le `manifestOf` v2 posé en tâche 5. Puis :

```ts
function inspectRequest(body: FormData | string, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/platform/badge-templates/inspect", {
    method: "POST",
    body,
    headers,
  });
}

function formWith(archive: Buffer): FormData {
  const form = new FormData();
  form.set("archive", new File([new Uint8Array(archive)], "template.zip", { type: "application/zip" }));
  return form;
}

async function inspect(body: FormData | string, headers?: Record<string, string>) {
  const { POST } = await import("../route");
  return POST(inspectRequest(body, headers));
}

async function asAdmin() {
  const staff = await makeStaff("STAFF_ADMIN");
  withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
  return staff;
}

describe("POST /api/platform/badge-templates/inspect", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("rend les variables, la suggestion et les sources, sans rien installer", async () => {
    await asAdmin();
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variables.map((v: { name: string }) => v.name)).toEqual(["participant.firstName", "structure"]);
    // Identite pour le nom de source, rien pour le nom libre : il reste a decider.
    expect(body.suggested).toEqual({ "participant.firstName": "participant.firstName" });
    expect(body.sources["category.color"]).toBe("color");
    expect(Object.keys(body.sources)).toHaveLength(15);
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse sans session (401)", async () => {
    // Meme garde que la route d'installation : l'inspection lit le contenu d'un
    // paquet, ce n'est pas une surface publique.
    noSession();
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(401);
  });

  it("refuse un STAFF_SUPPORT (403)", async () => {
    const staff = await makeStaff("STAFF_SUPPORT");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const res = await inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) })));
    expect(res.status).toBe(403);
  });

  it("propage une erreur non-AuthError levee pendant le controle de role", async () => {
    await asAdmin();
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-inspect"));
    await expect(
      inspect(formWith(await archiveOf({ "manifest.json": JSON.stringify(manifestOf()) }))),
    ).rejects.toThrow("boom-inspect");
    spy.mockRestore();
  });

  it("refuse une requete sans fichier (400)", async () => {
    await asAdmin();
    const res = await inspect(new FormData());
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/fichier manquant/i);
  });

  it("refuse une requete dont le corps n'est pas un formulaire (400)", async () => {
    await asAdmin();
    const res = await inspect("pas un formulaire", { "content-type": "multipart/form-data; boundary=xxx" });
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/fichier manquant/i);
  });

  it("refuse une archive depassant la borne de taille (400)", async () => {
    await asAdmin();
    const form = new FormData();
    form.set("archive", new File([new Uint8Array(11 * 1024 * 1024)], "gros.zip"));
    const res = await inspect(form);
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/taille/i);
  });

  it("refuse un paquet invalide (400) en listant les erreurs", async () => {
    await asAdmin();
    const res = await inspect(formWith(await archiveOf({ "assets/f.png": PNG })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join()).toMatch(/manifest\.json/i);
  });
});
```

Ces huit cas couvrent chaque branche de la route : le seuil de 100 % sur `src/app/api/**` tient.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Écrire la route d'inspection**

Créer `src/app/api/platform/badge-templates/inspect/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { MAX_ARCHIVE_BYTES, readTemplatePackage } from "@/lib/badge-templates/engine/package-reader";
import { SOURCE_KINDS, suggestBindings } from "@/lib/badge-templates/bindings";

export const runtime = "nodejs";

function badRequest(errors: string[]) {
  return NextResponse.json({ error: "INVALID_PACKAGE", errors }, { status: 400 });
}

// Lecture seule, volontairement separee de l'installation : rien n'est ecrit
// tant que l'administrateur n'a pas vu et complete ses liaisons. L'archive
// transite deux fois, ce que MAX_ARCHIVE_BYTES borne deja.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  try {
    await requireStaff(session.user.id, "STAFF_ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("archive");
  if (!(file instanceof File)) {
    return badRequest(["archive : fichier manquant."]);
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return badRequest([`archive : taille superieure a ${MAX_ARCHIVE_BYTES} octets.`]);
  }

  const read = await readTemplatePackage(Buffer.from(await file.arrayBuffer()));
  if (!read.ok) return badRequest(read.errors);

  return NextResponse.json({
    variables: read.manifest.variables,
    suggested: suggestBindings(read.manifest.variables),
    sources: SOURCE_KINDS,
  });
}
```

Pas de `logActivity` : la route n'écrit rien et ne change aucun état, c'est l'installation qui journalise.

- [ ] **Step 4: Lancer le test**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Construire l'écran de liaison**

Dans `src/components/staff/BadgeTemplateInstaller.tsx`, passer à deux écrans. Remplacer l'état et la fonction `install` par :

```tsx
type Variable = { name: string; kind: string; label: string };
type Inspection = {
  file: File;
  variables: Variable[];
  bindings: Record<string, string | null | undefined>;
  sources: Record<string, string>;
};

  const [inspection, setInspection] = useState<Inspection | null>(null);

  async function inspect(file: File) {
    setErrors([]);
    setSuccess(null);
    const form = new FormData();
    form.set("archive", file);
    const res = await fetch("/api/platform/badge-templates/inspect", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(data.errors ?? ["La lecture du paquet a échoué."]);
      return;
    }
    // Une variable sans suggestion reste NON DECIDEE (undefined) : le bouton
    // d'installation attend un choix explicite, fût-il « laisser vide ».
    setInspection({ file, variables: data.variables, bindings: data.suggested, sources: data.sources });
  }

  async function install() {
    if (!inspection) return;
    setErrors([]);
    const form = new FormData();
    form.set("archive", inspection.file);
    form.set("bindings", JSON.stringify(inspection.bindings));

    const res = await fetch("/api/platform/badge-templates", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(data.errors ?? ["L'installation a échoué."]);
      return;
    }
    setSuccess(`Template « ${data.family} » installé en version ${data.version}.`);
    setInspection(null);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

  const decided = (inspection?.variables ?? []).every(
    (variable) => inspection!.bindings[variable.name] !== undefined,
  );
```

Câbler l'`<input type="file">` sur `inspect` au lieu de `install`, et rendre le tableau sous la zone de dépôt quand `inspection` est non nul :

```tsx
      {inspection && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Liaisons des variables</h3>
          <p className="mt-1 text-xs text-slate-600">
            Chaque variable du template doit recevoir une source, ou être laissée vide
            explicitement.
          </p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {inspection.variables.map((variable) => (
                <tr key={variable.name}>
                  <td className="py-1 pr-3 font-mono text-xs">{variable.name}</td>
                  <td className="py-1 pr-3 text-xs text-slate-500">{variable.kind}</td>
                  <td className="py-1">
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={
                        inspection.bindings[variable.name] === undefined
                          ? ""
                          : (inspection.bindings[variable.name] ?? "__empty__")
                      }
                      onChange={(e) =>
                        setInspection({
                          ...inspection,
                          bindings: {
                            ...inspection.bindings,
                            [variable.name]:
                              e.target.value === ""
                                ? undefined
                                : e.target.value === "__empty__"
                                  ? null
                                  : e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">— choisir —</option>
                      <option value="__empty__">— laisser vide —</option>
                      {Object.entries(inspection.sources)
                        .filter(([, kind]) => kind === variable.kind)
                        .map(([source]) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            disabled={!decided || pending}
            onClick={() => void install()}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            Installer
          </button>
        </div>
      )}
```

- [ ] **Step 6: Étendre l'e2e**

Dans `e2e/platform/badge-templates.spec.ts` :

1. Réécrire `manifestOf(family)` au format v2. Le fixture actuel est en v1, et en millimètres (`widthMm`, `heightMm`) : partir du `manifestOf` v2 posé en tâche 5 (en `widthPx`/`heightPx`), avec `family` en paramètre et sérialisé par `JSON.stringify`.
2. Le parcours de téléversement traverse maintenant l'écran : après le dépôt du fichier, attendre le titre `Liaisons des variables` ; vérifier que la ligne `participant.firstName` est pré-remplie et que le bouton « Installer » est **désactivé** tant que `structure` n'est pas décidée ; choisir `participant.structure` pour `structure` ; cliquer « Installer » ; attendre le message de succès.

Run: `make test-e2e` (conteneurs de dev démarrés).
Expected: PASS, y compris les scénarios déjà présents du fichier.

- [ ] **Step 7: Vérifier**

Run: `make lint && make typecheck && make test && make test-coverage`
Expected: PASS — toute la suite, paquets de référence compris, 100 % hors `engine/`.

Puis **vérifier dans le navigateur** (`https://badge.local` ou `http://localhost:3785`, compte staff du seed) : téléverser une archive exportée de pdfStudio, contrôler le pré-remplissage, le filtrage des sources par type, le bouton grisé tant qu'une ligne n'est pas décidée, l'option « laisser vide », puis l'installation. Rapporter ce qui a été vu, pas ce qui devrait l'être.

- [ ] **Step 8: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add src/app/api/platform/badge-templates/inspect src/components/staff/BadgeTemplateInstaller.tsx e2e/platform/badge-templates.spec.ts
git commit -m "feat(installation): ecran de liaison des variables au televersement"
```

---

### Task 7: Migrer les templates installés en base (script, exécuté en dev uniquement)

**Files:**
- Create: `scripts/migrate-installed-templates-v2.ts`
- Test: `scripts/__tests__/migrate-installed-templates-v2.test.ts`
- Modify: `scripts/validate-badge-templates.ts`
- Modify: `Makefile`

**Interfaces:**
- Consumes: `migrateManifest`, `V1_VARIABLES` (tâche 5) ; `parseManifest` ; `validateBindings` (tâche 2).
- Produces: `migrateInstalledTemplates({ apply }): Promise<{ migrated: string[]; skipped: Array<{ id: string; reason: string }> }>`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `scripts/__tests__/migrate-installed-templates-v2.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { migrateInstalledTemplates } from "../migrate-installed-templates-v2";

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
```

Le `LAYOUT_V1` ci-dessus suffit : il couvre les deux conversions que fait `migrateManifest` (un gabarit de texte, et un `visibleIf` dont la clé `path` devient `variable`). Le modèle `User` a pour champs obligatoires `email`, `password` et `name`.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run scripts/__tests__/migrate-installed-templates-v2.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le script**

Créer `scripts/migrate-installed-templates-v2.ts` :

```ts
import { PrismaClient } from "@prisma/client";
import { listPrefix } from "../src/lib/storage";
import { migrateManifest, V1_VARIABLES } from "../src/lib/badge-templates/migrate-v1";
import { parseManifest } from "../src/lib/badge-templates/engine/declarative/schema";
import { validateBindings, type Bindings } from "../src/lib/badge-templates/bindings";

const prisma = new PrismaClient();

export type MigrationReport = {
  migrated: string[];
  skipped: Array<{ id: string; reason: string }>;
};

// La table de liaison d'un template migre est l'IDENTITE : les variables produites
// par migrateManifest portent exactement le nom des sources v1. Aucun choix humain
// n'est requis, c'est ce qui rend la migration automatisable de bout en bout.
const IDENTITY: Bindings = Object.fromEntries(
  V1_VARIABLES.map((variable) => [variable.name, variable.name]),
);

export async function migrateInstalledTemplates(options: {
  apply: boolean;
}): Promise<MigrationReport> {
  const report: MigrationReport = { migrated: [], skipped: [] };
  const rows = await prisma.installedBadgeTemplate.findMany({ where: { formatVersion: 1 } });

  for (const row of rows) {
    // migrateManifest n'attache un sample d'image que si la ressource existe :
    // il lui faut donc la liste reelle des fichiers du paquet.
    // listPrefix rend des { key, size } aux cles completes ; le manifeste parle
    // en chemins relatifs au paquet (« assets/photo-demo.png »).
    const entries = (await listPrefix(row.assetPrefix)).map(({ key }) =>
      key.slice(row.assetPrefix.length),
    );

    let layout: unknown;
    try {
      layout = migrateManifest(row.layout, entries).manifest;
    } catch (err) {
      report.skipped.push({ id: row.id, reason: `migration : ${(err as Error).message}` });
      continue;
    }

    const parsed = parseManifest(layout, entries);
    if (!parsed.ok) {
      report.skipped.push({ id: row.id, reason: `validation : ${parsed.errors.join(" | ")}` });
      continue;
    }

    const errors = validateBindings(parsed.manifest.variables, IDENTITY);
    if (errors.length > 0) {
      report.skipped.push({ id: row.id, reason: `liaisons : ${errors.join(" | ")}` });
      continue;
    }

    if (options.apply) {
      await prisma.installedBadgeTemplate.update({
        where: { id: row.id },
        data: {
          layout: parsed.manifest as unknown as object,
          bindings: IDENTITY as unknown as object,
          formatVersion: 2,
        },
      });
    }
    report.migrated.push(row.id);
  }

  return report;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const report = await migrateInstalledTemplates({ apply });
  console.log(apply ? "MIGRATION APPLIQUEE" : "DRY-RUN (ajouter --apply pour ecrire)");
  console.log(`migres : ${report.migrated.length}`);
  for (const skipped of report.skipped) console.error(`SAUTE ${skipped.id} : ${skipped.reason}`);
  process.exit(report.skipped.length > 0 ? 1 : 0);
}

if (process.argv[1]?.endsWith("migrate-installed-templates-v2.ts")) void main();
```

Les imports sont relatifs, comme dans les autres scripts du dossier (`scripts/pack-badge-template.ts`, `scripts/migrate-badge-template-refs.ts`).

- [ ] **Step 4: Lancer les tests**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run scripts/__tests__/migrate-installed-templates-v2.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Étendre le contrôle de cohérence**

`scripts/validate-badge-templates.ts` n'a pas de drapeau d'échec : il sort par `process.exit` dès qu'il conclut. Trois modifications.

En tête, ajouter les imports :

```ts
import type { VariableDeclaration } from "../src/lib/badge-templates/engine/declarative/manifest-types";
import { validateBindings, type Bindings } from "../src/lib/badge-templates/bindings";
```

Élargir la sélection initiale pour lire le manifeste et la table :

```ts
  const installed = await prisma.installedBadgeTemplate.findMany({
    select: { id: true, family: true, version: true, formatVersion: true, layout: true, bindings: true },
  });
```

Juste après le contrôle `hasDefaultFamily`, collecter les lignes défaillantes :

```ts
  // Deuxieme garde du meme script : une ligne restee en v1 n'est plus rendable par
  // le moteur v2, et une ligne dont les liaisons ne couvrent pas toutes les
  // variables imprimerait des champs vides sans que personne l'ait voulu.
  const bindingIssues: string[] = [];
  for (const t of installed) {
    if (t.formatVersion !== 2) {
      bindingIssues.push(`${t.family} v${t.version} : encore au format v${t.formatVersion} (make migrate-installed-templates).`);
      continue;
    }
    const variables = (t.layout as unknown as { variables: VariableDeclaration[] }).variables;
    const errors = validateBindings(variables, (t.bindings ?? {}) as Bindings);
    if (errors.length > 0) bindingIssues.push(`${t.family} v${t.version} : ${errors.join(" | ")}`);
  }
```

Puis remplacer la condition de succès `if (orphans.length === 0) {` par `if (orphans.length === 0 && bindingIssues.length === 0) {`, et, avant la ligne `` console.error(`KO : ${orphans.length} badgeTemplateId orphelin(s) detecte(s) :`); ``, insérer :

```ts
  if (bindingIssues.length > 0) {
    console.error(`KO : ${bindingIssues.length} template(s) aux liaisons incompletes :`);
    for (const issue of bindingIssues) console.error(`  - ${issue}`);
  }
  if (orphans.length === 0) process.exit(1);
```

(Ce `process.exit(1)` évite d'afficher « 0 orphelin(s) » quand seules les liaisons sont en cause.) Mettre à jour le commentaire d'en-tête du script : il valide désormais aussi le format et les liaisons.

- [ ] **Step 6: Ajouter la cible Makefile**

Dans la liste `.PHONY` puis dans le corps du `Makefile`, à côté de `validate-badge-templates` :

```make
# Migre les templates installes du format v1 vers le v2 (dry-run par defaut,
# ARGS=--apply pour ecrire). Le moteur v2 ne sait pas rendre une ligne restee en v1.
migrate-installed-templates:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/migrate-installed-templates-v2.ts $(ARGS)
```

La cible vise le conteneur **de dev**, comme `validate-badge-templates`. Ne pas créer de variante `prod-*` : l'exécution en production relève de la release, hors de ce plan.

- [ ] **Step 7: Vérifier**

Run: `make lint && make typecheck && make test && make test-coverage`
Expected: PASS, 100 % hors `engine/`.

Puis, **contre la base de dev uniquement** :

```bash
make migrate-installed-templates                 # dry-run : liste ce qui serait migre
make migrate-installed-templates ARGS=--apply    # ecrit, en dev
make migrate-installed-templates                 # doit rapporter « migres : 0 » (idempotence)
make validate-badge-templates                    # doit sortir OK
```

Si la base de dev a été remise à zéro en tâche 5, il n'y a aucune ligne v1 : le dry-run rapporte 0, c'est normal. Sinon, ouvrir ensuite un badge rendu depuis un template migré et le comparer à l'ancien rendu (réserve de fuseau : voir la spec).

- [ ] **Step 8: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add scripts/migrate-installed-templates-v2.ts scripts/__tests__/migrate-installed-templates-v2.test.ts scripts/validate-badge-templates.ts Makefile
git commit -m "feat(migration): templates installes du format v1 vers le v2"
```

---

### Task 8: Nettoyage et documentation

**Files:**
- Delete: `scripts/new-badge-template.ts`, `scripts/__tests__/new-badge-template.test.ts`
- Modify: `Makefile` (cible `new-badge-template` retirée de `.PHONY` et du corps)
- Modify: `docs/v4/features/templates-badges.md`
- Modify: `docs/v4/installation.md`
- Modify: `docs/v4/README.md`
- Modify: `docs/v4/specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md` (statut)
- Modify (**hors dépôt, sur autorisation explicite**) : `../pdfStudio/README.md`

**Interfaces:**
- Consumes: tout ce qui précède, pour décrire l'état réel.
- Produces: rien.

- [ ] **Step 1: Retirer le générateur de squelette**

```bash
grep -rn "new-badge-template" --include="*.ts" --include="Makefile" --include="*.md" . | grep -v node_modules | grep -v "docs/v4/plans\|docs/v4/specs"
git rm scripts/new-badge-template.ts scripts/__tests__/new-badge-template.test.ts
```

Retirer la cible `new-badge-template` du `Makefile` (entrée `.PHONY` ligne ~11, corps ligne ~349). Les plans et specs passés ne se réécrivent pas : ils gardent leur mention historique.

- [ ] **Step 2: Mettre à jour la doc de la feature**

`docs/v4/features/templates-badges.md` décrit encore le format v1. Section par section :

- **En-tête** : ajouter la spec 20 à côté de la spec 10 comme source du *pourquoi*.
- **État actuel** : ajouter le paragraphe suivant.

  ```markdown
  Le moteur de rendu (`src/lib/badge-templates/engine/`) est une **copie scellée** de
  `pdfStudio/src/engine/`. On ne le modifie jamais ici : corriger dans pdfStudio, puis
  `make sync-engine`. Un test de parité (`engine-parity.test.ts`) refuse toute édition
  faite sur place ; `engine/SOURCE.md` dit de quel commit pdfStudio la copie provient.
  Le moteur ne connaît aucun nom métier : il rend un document sur un dictionnaire de
  valeurs, que `build-values.ts` dérive du contexte d'inscription et de la table de
  liaison du template.
  ```

- **Installation** : décrire les deux temps — `POST /api/platform/badge-templates/inspect` (lecture seule, rend `variables`, `suggested`, `sources`), puis l'écran de liaison (un sélecteur par variable, filtré par type ; trois états : non décidé, « laisser vide », une source ; bouton grisé tant qu'une ligne n'est pas décidée), puis `POST /api/platform/badge-templates` avec `archive` + `bindings`, refusé en 400 avec la liste complète des erreurs. Préciser que les paquets livrés (`default`, `recto-verso`) portent leur table dans `prisma/badge-templates/<famille>/bindings.json`, et qu'une table ne s'édite pas après installation : il faut réinstaller.
- **Structure d'un paquet** : mentionner `bindings.json`, **propre aux paquets livrés** avec l'application (pdfStudio n'en produit pas).
- **Manifeste** : remplacer l'exemple et la description v1 par le format v2 (`formatVersion: 2`, `variables`, `conditions`, `presets`). La source de vérité est `src/lib/badge-templates/engine/declarative/schema.ts` ; la description détaillée du format existe déjà dans `../pdfStudio/docs/superpowers/specs/2026-09-18-manifeste-v2-variables-design.md` — la reprendre en l'adaptant, sans inventer de champ absent du schéma.
- **Sources disponibles** : devient « Liaisons et sources ». Garder le tableau des 15 sources (elles vivent désormais dans `bindings.ts`, `SOURCE_KINDS`), mais expliquer qu'un manifeste ne les référence plus : il déclare des variables aux noms libres, et la table de liaison dit quelle source alimente chaque variable. Une variable liée à une source d'un autre type est refusée. Une variable « laissée vide » n'est pas écrite : `isEmpty` joue. `event.date` est transmise brute : le **format de date appartient à la variable** (cinq formats, calendaire en UTC) et non plus à `formatFrenchDate`.
- **Conditions d'affichage** : passer à `visibleIf.variable` et aux conditions nommées ; supprimer la restriction « seuls `category.anonymous` et `category.neutralBadge` » (`CONDITION_PATHS` n'existe plus).
- **Créer un template** : retirer toute mention de `make new-badge-template` ; le studio crée, l'application installe et rend.
- **Migration d'une base antérieure** : ajouter `make migrate-installed-templates` (dry-run par défaut, `ARGS=--apply` pour écrire, idempotent, table de liaison par identité, templates archivés compris), la réserve de fuseau de la spec 20, le fait que les épreuves existantes ne sont pas regénérées, et l'extension de `make validate-badge-templates` (lignes restées en v1, liaisons incomplètes).

- [ ] **Step 3: Mettre à jour l'installation et l'index**

Dans `docs/v4/installation.md`, dans le tableau des commandes de templates, retirer la ligne `make new-badge-template` et ajouter :

```markdown
| `make sync-engine` | Resynchronise le moteur `src/lib/badge-templates/engine/` depuis `../pdfStudio` (sur l'hôte) |
| `make migrate-installed-templates [ARGS=--apply]` | Migre les templates installés du format v1 vers le v2 (dry-run par défaut) |
```

et compléter le paragraphe sur `make validate-badge-templates` : il signale aussi les lignes restées en v1 et les tables de liaison incomplètes.

Dans `docs/v4/README.md`, ajouter sous la spec 19 :

```markdown
- [Spec 20 — Moteur v2 et liaisons de variables](specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md) · [Plan](plans/2026-09-22-moteur-v2-et-liaisons.md) · [Feature](features/templates-badges.md)
```

- [ ] **Step 4: Passer la spec en « implémentée »**

Dans l'en-tête de `docs/v4/specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md`, remplacer `**à implémenter**` par `**implémentée** (<date du jour>)`. Ne rien changer d'autre à la spec : c'est l'ADR, elle garde son raisonnement d'origine.

- [ ] **Step 5: Documenter la même chose côté studio — sur autorisation uniquement**

`../pdfStudio` est **hors de ce dépôt**. Avant toute écriture, demander explicitement à l'utilisateur l'autorisation de modifier `../pdfStudio/README.md`. Sans accord, sauter ce step, le marquer dans la Progression et fournir le texte ci-dessous dans le compte rendu.

Avec accord : remplacer le paragraphe qui dit que le moteur est « une copie du moteur de l'application badge — toute évolution de format doit être reportée des deux côtés » par :

```markdown
Le moteur de rendu (`src/engine/`) fait autorité : l'application badge en héberge une
copie scellée, qu'elle resynchronise par `make sync-engine` (un test de parité y refuse
toute édition locale). Une évolution du format se fait donc **ici**, puis se reporte
là-bas par une resynchronisation — jamais l'inverse.
```

Ce changement ne se commite pas depuis ce dépôt ; un éventuel commit dans pdfStudio suit la même règle (demande explicite de l'utilisateur).

- [ ] **Step 6: Vérifier**

Run: `make lint && make typecheck && make test`
Expected: PASS.

- [ ] **Step 7: Point de commit — uniquement sur demande explicite de l'utilisateur**

Ne pas commiter de sa propre initiative : proposer le commit ci-dessous et attendre le feu vert.

```bash
git add Makefile scripts docs/v4/features/templates-badges.md docs/v4/installation.md docs/v4/README.md docs/v4/specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md docs/v4/plans/2026-09-22-moteur-v2-et-liaisons.md
git commit -m "docs(templates): le studio cree, l'application installe et rend"
```

---

## Vérification finale

Tout se passe **en local, sur la branche `development`**. Aucune étape ne touche la production.

- [ ] `make lint && make typecheck && make test` — passe.
- [ ] `make test-coverage` — 100 % hors `engine/`.
- [ ] `make test-e2e` — passe, parcours de liaison compris.
- [ ] `make sync-engine` (sur l'hôte) puis `git status` : **aucun diff** dans `engine/`.
- [ ] Dans le navigateur : un `.zip` exporté de pdfStudio (variables aux noms libres) se téléverse, montre son écran de liaison pré-rempli, refuse l'installation tant qu'une ligne n'est pas décidée, puis s'installe.
- [ ] Un badge rendu depuis ce template porte les bonnes valeurs, la date au format déclaré par le manifeste, et respecte les conditions nommées.
- [ ] Une variable « laissée vide » s'imprime vide et déclenche les blocs `isEmpty`.
- [ ] En dev : `make migrate-installed-templates ARGS=--apply` migre toutes les lignes v1, un second passage rapporte 0 (idempotence), et un badge rendu depuis un template migré est identique à l'ancien — à la réserve de fuseau documentée dans la spec.
- [ ] `make validate-badge-templates` sort OK, et signale une table de liaison incomplète quand on en fabrique une (vider `bindings` d'une ligne en dev, relancer, puis restaurer par `make db-seed` ou en réinstallant).
- [ ] La section `## Progression` est à jour, toutes les tasks à `[x]` (ou `[-]` justifié).

## Hors plan : mise en production

**Ce plan ne déploie pas.** Il s'arrête à une branche `development` verte ; aucun agent n'exécute de commande `prod-*`, `preprod-*`, `deploy` ou `upload`, ni ne se connecte en SSH.

Pour mémoire, à l'intention de l'utilisateur qui décidera de la release : depuis la tâche 5, le moteur v2 ne sait plus rendre une ligne restée en v1. L'ordre de mise en production n'est donc pas libre — pousser le schéma, migrer les lignes, puis seulement basculer le trafic, dans la même fenêtre. La séquence est décrite dans la spec (§ « Migration des lignes en base », conséquence 2) ; la cible `migrate-installed-templates` créée ici vise le conteneur de dev, et son équivalent de production est à prévoir au moment de la release.
