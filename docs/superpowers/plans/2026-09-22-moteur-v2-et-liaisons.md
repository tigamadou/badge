# Moteur v2 et liaisons de variables — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre un template conçu dans pdfStudio installable et utilisable directement dans l'application badge, en y portant le moteur déclaratif v2 et en y ajoutant une table de liaison entre variables déclarées et données métier.

**Architecture:** Le moteur de pdfStudio est **copié** dans `src/lib/badge-templates/engine/`, dossier scellé qu'un test d'empreinte interdit d'éditer sur place. Autour de lui, du code propre au badge : `bindings.ts` (le vocabulaire métier et sa validation), `build-values.ts` (TemplateContext + liaisons → VariableValues). Les liaisons sont choisies à l'installation sur un écran dédié et stockées en base ; les templates v1 déjà installés sont migrés par script, avec une table déduite par identité.

**Tech Stack:** Next.js (App Router), Prisma + MySQL, `@react-pdf/renderer`, Zod, Vitest (couverture 100 % imposée sur `src/lib/**` et `src/app/api/**`), Playwright pour l'e2e, stockage S3/MinIO.

**Spec:** `docs/v4/specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md`

## Global Constraints

- **`src/lib/badge-templates/engine/**` est scellé.** Il ne se modifie que par `scripts/sync-engine.ts`. Toute correction du moteur se fait **dans pdfStudio**, puis se resynchronise. Un agent qui veut « juste corriger une ligne » dans ce dossier doit s'arrêter et le signaler.
- **Couverture 100 %** (lignes, branches, fonctions, instructions) sur `src/lib/**` et `src/app/api/**`, `engine/**` excepté (exclusion posée en tâche 1). Un test manquant casse la CI.
- **Le dépôt pdfStudio doit être présent en `../pdfStudio`** pour les tâches 1 et 9. Sa branche doit être à jour : le portage copie l'état de `src/engine/` tel quel.
- **Pas de `prisma/migrations`** dans ce dépôt : le schéma se pousse (`make db-push` en dev, `make prod-db-push` en prod).
- Les tests partagent une base MySQL unique, remise à zéro avant chaque test (`src/test-setup.ts`) et exécutés **séquentiellement** (`fileParallelism: false`). Ne jamais supposer une base vierge autrement.
- Commentaires **en français**, expliquant le *pourquoi*. C'est la norme du dépôt, y compris dans les fichiers copiés (ils viennent déjà ainsi).
- Les 15 sources du domaine badge, avec leur type, sont **exactement** celles de l'actuel `src/lib/badge-templates/declarative/sources.ts`. Ne pas en inventer, ne pas en retirer.
- Lancer un fichier de test : `npx vitest run <chemin>`. Toute la suite : `npm test`. Types : `npx tsc --noEmit`.

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

Run: `npx vitest run src/lib/badge-templates/__tests__/engine-parity.test.ts`
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

Run: `npm test`
Expected: PASS — les tests du moteur portés s'exécutent maintenant en plus des anciens. **Si un test porté échoue, ne pas le corriger sur place** : le noter et le remonter, c'est un signal que la copie ne tourne pas dans les mêmes conditions que chez elle.

- [ ] **Step 8: Commit**

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

Run: `npx vitest run src/lib/badge-templates/__tests__/bindings.test.ts`
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

Run: `npx vitest run src/lib/badge-templates/__tests__/bindings.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

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

Run: `npx vitest run src/lib/badge-templates/__tests__/build-values.test.ts`
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

Run: `npx vitest run src/lib/badge-templates/__tests__/build-values.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

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

Run: `npm test`
Expected: PASS — la colonne est additive, rien ne la lit encore.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(bdd): table de liaison des variables sur un template installe"
```

---

### Task 5: ◆ Bascule — le moteur v2 remplace le v1

**Files:**
- Modify: `src/lib/badge-templates/types.ts`, `resolve.ts`, `install.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx`
- Create: `src/lib/badge-templates/migrate-v1.ts` (porté de pdfStudio)
- Modify: `prisma/badge-templates/{default,recto-verso}/manifest.json`, `badge-templates/ex-305v/manifest.json`
- Create: `prisma/badge-templates/{default,recto-verso}/bindings.json`
- Delete: `src/lib/badge-templates/declarative/` (tout le dossier), `fonts.ts`, `package-reader.ts`, `px.ts`, `render-proof.tsx` et leurs tests
- Test: `src/lib/badge-templates/__tests__/{resolve.test.tsx,install.test.ts,reference-packages.test.ts}`

**Interfaces:**
- Consumes: `engine/` (tâche 1) ; `Bindings`, `validateBindings` (tâche 2) ; `buildValues` (tâche 3) ; la colonne `bindings` (tâche 4).
- Produces: `BadgeTemplate` = `{ meta, variables: VariableDeclaration[], bindings: Bindings, Component: ComponentType<{ values: VariableValues }> }` ; `installTemplate({ manifest, assets, bindings, installedById })` avec `bindings` **obligatoire** ; `readReferencePackage(family)` rend en plus `bindings` ; `migrateManifest(input, entries)` et `V1_VARIABLES`, réutilisés par la tâche 7.

**Cette tâche est volontairement grosse : elle ne se découpe pas.** Dès qu'un fichier pointe vers `engine/`, il reçoit un schéma v2 qui refuse les manifestes v1 et un `Component` qui prend `values` — le dépôt ne compile et ne passe ses tests qu'une fois la bascule entière faite. Ne pas commiter à mi-chemin.

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

Dans `src/lib/badge-templates/__tests__/install.test.ts`, compléter **tous** les appels à `installTemplate` avec une table (l'identité des 15 variables convient) et ajouter :

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

- [ ] **Step 12: Vérifier**

Run: `npm test && npx tsc --noEmit`
Expected: PASS des deux. **C'est ici que la bascule se valide** : si la suite passe, l'application rend désormais par le moteur v2. La route d'installation ne compile pas encore avec un champ `bindings` — elle est traitée en tâche 6 ; en attendant, lui passer une table vide provoquerait un refus légitime. Si son test échoue pour cette raison, le noter et poursuivre.

- [ ] **Step 13: Recharger la base et regarder un badge**

```bash
make db-reset && make db-seed && make dev
```

Ouvrir un badge d'une inscription de démonstration : il doit s'imprimer comme avant.

- [ ] **Step 14: Commit**

```bash
git add -A src/lib/badge-templates src/app/api prisma/badge-templates badge-templates scripts
git commit -m "feat(rendu): bascule sur le moteur v2, rendu par dictionnaire de valeurs"
```

---

### Task 6: Route d'inspection, route d'installation, écran de liaison

**Files:**
- Create: `src/app/api/platform/badge-templates/inspect/route.ts`
- Create: `src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
- Modify: `src/app/api/platform/badge-templates/route.ts`
- Modify: `src/app/api/platform/badge-templates/__tests__/route.test.ts`
- Modify: `src/components/staff/BadgeTemplateInstaller.tsx`

**Interfaces:**
- Consumes: `SOURCE_KINDS`, `suggestBindings`, `validateBindings`, `Bindings` (tâche 2) ; `installTemplate` avec son argument `bindings` (tâche 5) ; `readTemplatePackage`, `MAX_ARCHIVE_BYTES` de `@/lib/badge-templates/engine/package-reader`.
- Produces: `POST /api/platform/badge-templates/inspect` → `{ variables: VariableDeclaration[], suggested: Bindings, sources: Record<string, VariableKind> }` ; `POST /api/platform/badge-templates` accepte en plus un champ de formulaire `bindings` (JSON sérialisé).

- [ ] **Step 1: Écrire le test de la route d'inspection**

Créer `src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`, en calquant l'installation de session et de staff sur le fichier de test voisin `src/app/api/platform/badge-templates/__tests__/route.test.ts` (mêmes mocks `getServerSession` / `requireStaff`, même fabrication d'archive ZIP) :

```ts
  it("rend les variables, la suggestion et les sources, sans rien installer", async () => {
    const res = await POST(requestWith(archive));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variables.map((v: { name: string }) => v.name)).toContain("participant.firstName");
    expect(body.suggested["participant.firstName"]).toBe("participant.firstName");
    expect(body.sources["category.color"]).toBe("color");
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse un paquet invalide", async () => {
    const res = await POST(requestWith(Buffer.from("ceci n'est pas un zip")));
    expect(res.status).toBe(400);
  });

  it("refuse un utilisateur non authentifie", async () => {
    // Meme garde que la route d'installation : l'inspection lit le contenu d'un
    // paquet, ce n'est pas une surface publique.
    const res = await POST(requestWith(archive));
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
Expected: FAIL — la route n'existe pas.

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
    return NextResponse.json({ error: "INVALID_PACKAGE", errors: ["archive : fichier manquant."] }, { status: 400 });
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return NextResponse.json(
      { error: "INVALID_PACKAGE", errors: [`archive : taille superieure a ${MAX_ARCHIVE_BYTES} octets.`] },
      { status: 400 },
    );
  }

  const read = await readTemplatePackage(Buffer.from(await file.arrayBuffer()));
  if (!read.ok) {
    return NextResponse.json({ error: "INVALID_PACKAGE", errors: read.errors }, { status: 400 });
  }

  return NextResponse.json({
    variables: read.manifest.variables,
    suggested: suggestBindings(read.manifest.variables),
    sources: SOURCE_KINDS,
  });
}
```

- [ ] **Step 4: Lancer le test**

Run: `npx vitest run src/app/api/platform/badge-templates/inspect/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Faire accepter les liaisons à la route d'installation**

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
  const bindingErrors = validateBindings(manifest.variables, bindings);
  if (bindingErrors.length > 0) return badRequest(bindingErrors);
```

Puis passer `bindings` à l'appel `installTemplate({ manifest, assets, bindings, installedById: … })`.

Ajouter dans `src/app/api/platform/badge-templates/__tests__/route.test.ts` un cas de refus, et compléter les appels existants avec le champ `bindings` :

```ts
  it("refuse une installation dont les liaisons sont incompletes", async () => {
    const form = new FormData();
    form.set("archive", new File([archive], "t.zip"));
    form.set("bindings", JSON.stringify({}));
    const res = await POST(new NextRequest("http://localhost/api/platform/badge-templates", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors[0]).toContain("aucune source choisie");
  });
```

- [ ] **Step 6: Lancer les tests des deux routes**

Run: `npx vitest run src/app/api/platform/badge-templates`
Expected: PASS.

- [ ] **Step 7: Construire l'écran de liaison**

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

- [ ] **Step 8: Étendre l'e2e**

Dans `e2e/platform/badge-templates.spec.ts`, le parcours de téléversement traverse maintenant l'écran : après le dépôt du fichier, attendre le tableau (`Liaisons des variables`), choisir une source pour chaque ligne non pré-remplie, puis cliquer « Installer ».

- [ ] **Step 9: Vérifier**

Run: `npm test && npx tsc --noEmit`
Expected: PASS — toute la suite, paquets de référence compris.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/platform/badge-templates src/components/staff/BadgeTemplateInstaller.tsx e2e/platform/badge-templates.spec.ts
git commit -m "feat(installation): ecran de liaison des variables au televersement"
```

---

### Task 7: Migrer les templates installés en base

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
    data: { email: `${id}@test.local`, name: "Test", passwordHash: "x" },
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

Le `LAYOUT_V1` ci-dessus suffit : il couvre les deux conversions que fait `migrateManifest` (un gabarit de texte, et un `visibleIf` dont la clé `path` devient `variable`). Si la création de l'utilisateur ne compile pas, aligner ses champs sur ceux du fichier voisin `src/lib/badge-templates/__tests__/install.test.ts`, qui en fabrique déjà un.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run scripts/__tests__/migrate-installed-templates-v2.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le script**

Créer `scripts/migrate-installed-templates-v2.ts` :

```ts
import { PrismaClient } from "@prisma/client";
import { listPrefix } from "@/lib/storage";
import { migrateManifest, V1_VARIABLES } from "@/lib/badge-templates/migrate-v1";
import { parseManifest } from "@/lib/badge-templates/engine/declarative/schema";
import { validateBindings, type Bindings } from "@/lib/badge-templates/bindings";

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
    const entries = (await listPrefix(row.assetPrefix)).map((key) =>
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

**Si `listPrefix` n'existe pas dans `@/lib/storage`**, regarder ce que le module expose (`grep -n "^export" src/lib/storage.ts`) et utiliser la fonction de listage disponible ; `deletePrefix` en suppose une.

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run scripts/__tests__/migrate-installed-templates-v2.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Étendre le contrôle de cohérence**

Dans `scripts/validate-badge-templates.ts`, en plus des `badgeTemplateId` orphelins, signaler les tables incomplètes :

```ts
  // Meme script, deuxieme garde : une ligne dont les liaisons ne couvrent pas
  // toutes les variables imprimerait des champs vides sans que personne l'ait voulu.
  for (const row of await prisma.installedBadgeTemplate.findMany()) {
    const manifest = row.layout as unknown as { variables: VariableDeclaration[] };
    const errors = validateBindings(manifest.variables ?? [], (row.bindings ?? {}) as Bindings);
    if (errors.length > 0) {
      console.error(`[liaisons] ${row.family} v${row.version} : ${errors.join(" | ")}`);
      failed = true;
    }
  }
```

(`failed` est la variable de sortie déjà présente dans le script ; l'adapter à son nom réel.)

- [ ] **Step 6: Ajouter la cible Makefile**

```make
# Migre les templates installes du format v1 vers le v2 (dry-run par defaut).
# A EXECUTER APRES `prod-db-push` ET AVANT la bascule du trafic : le moteur v2
# ne sait pas rendre une ligne restee en v1.
migrate-installed-templates:
	docker exec badge-app npx tsx scripts/migrate-installed-templates-v2.ts $(ARGS)
```

- [ ] **Step 7: Vérifier**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrate-installed-templates-v2.ts scripts/__tests__/migrate-installed-templates-v2.test.ts scripts/validate-badge-templates.ts Makefile
git commit -m "feat(migration): templates installes du format v1 vers le v2"
```

---

### Task 8: Nettoyage et documentation

**Files:**
- Delete: `scripts/new-badge-template.ts`, `scripts/__tests__/new-badge-template.test.ts`
- Modify: `Makefile`, `README.md`, `docs/README.md` si la commande y figure
- Modify: `../pdfStudio/README.md`

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1: Retirer le générateur de squelette**

```bash
grep -rn "new-badge-template" --include="*.ts" --include="Makefile" --include="*.md" . | grep -v node_modules
git rm scripts/new-badge-template.ts scripts/__tests__/new-badge-template.test.ts
```

Retirer la cible correspondante du `Makefile` et toute mention dans les docs.

- [ ] **Step 2: Documenter la répartition dans le README du badge**

Dans la section des templates de badges, ajouter :

```markdown
Les templates ne se créent plus ici : ils se composent dans **pdfStudio**, qui produit
une archive `.zip`. L'application la reçoit, demande à quelle donnée correspond chaque
variable déclarée (écran de liaison), puis l'installe et la rend.

Le moteur de `src/lib/badge-templates/engine/` est une **copie scellée** de
`pdfStudio/src/engine/` : on ne le modifie jamais ici. Corriger dans pdfStudio, puis
`make sync-engine`. Un test de parité refuse toute édition faite sur place.
```

- [ ] **Step 3: Documenter la même chose côté studio**

Dans `../pdfStudio/README.md`, remplacer le paragraphe qui dit que le moteur est « une copie du moteur de l'application badge — toute évolution de format doit être reportée des deux côtés » par la procédure réelle :

```markdown
Le moteur de rendu (`src/engine/`) fait autorité : l'application badge en héberge une
copie scellée, qu'elle resynchronise par `make sync-engine` (un test de parité y refuse
toute édition locale). Une évolution du format se fait donc **ici**, puis se reporte
là-bas par une resynchronisation — jamais l'inverse.
```

- [ ] **Step 4: Vérifier**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(templates): le studio cree, l'application installe et rend"
```

---

## Vérification finale

- [ ] `npm test` — toute la suite passe, couverture 100 % hors `engine/`.
- [ ] `npx tsc --noEmit` — aucune erreur.
- [ ] `npx tsx scripts/sync-engine.ts --from ../pdfStudio` puis `git status` : **aucun diff** dans `engine/`.
- [ ] Un `.zip` exporté de pdfStudio (variables aux noms libres) se téléverse, montre son écran de liaison pré-rempli, refuse l'installation tant qu'une ligne n'est pas décidée, puis s'installe.
- [ ] Un badge rendu depuis ce template porte les bonnes valeurs, la date au format déclaré par le manifeste, et respecte les conditions nommées.
- [ ] Une variable « laissée vide » s'imprime vide et déclenche les blocs `isEmpty`.
- [ ] `migrate-installed-templates-v2 --apply` migre toutes les lignes v1, est idempotent, et un badge rendu depuis un template migré est identique à l'ancien — à la réserve de fuseau documentée dans la spec.
- [ ] `validate-badge-templates` signale une table de liaison incomplète.

## Procédure de déploiement

L'ordre n'est pas libre : après la tâche 5, une ligne restée en v1 n'est plus rendable.

```
1. make prod-db-push                                  colonne bindings
2. make migrate-installed-templates ARGS=--apply      toutes les lignes passent en v2
3. bascule du trafic vers la nouvelle version
```

Les trois dans la même fenêtre, sans service entre 1 et 3. En cas d'échec à l'étape 2,
le rapport nomme chaque ligne sautée et sa raison : les corriger avant de basculer.
