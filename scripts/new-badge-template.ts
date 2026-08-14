import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Le squelette declare `assets/apercu.png` par defaut, mais seul le champ `preview`
// du manifeste fait foi : l'auteur peut le pointer vers n'importe quelle image du
// paquet. Tant que le fichier declare manque, `make pack-badge-template` refuse
// d'empaqueter -- ce qui est le rappel le plus utile possible.
function manifestOf(family: string) {
  return {
    formatVersion: 1,
    family,
    label: `Badge ${family}`,
    description: "Decrivez ici le badge en une phrase.",
    preview: "assets/apercu.png",
    page: { widthPx: 1011, heightPx: 638, count: 1 },
    blocks: [
      { type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 95, fill: "category.color" },
      {
        type: "text",
        page: 1,
        x: 47,
        y: 71,
        w: 709,
        h: 95,
        text: "{participant.firstName} {participant.lastName}",
        style: { sizePx: 50, weight: 700, color: "#0f172a", overflow: "shrink", minSizePx: 33 },
      },
      {
        type: "text",
        page: 1,
        x: 0,
        y: 573,
        w: 1011,
        h: 47,
        text: "{category.name}",
        style: {
          sizePx: 38,
          weight: 700,
          align: "center",
          color: "#ffffff",
          overflow: "clip",
          transform: "uppercase",
        },
      },
      { type: "qr", page: 1, x: 756, y: 354, w: 189, h: 189 },
    ],
  };
}

const README = (family: string) => `# Template de badge « ${family} »

Squelette genere par \`make new-badge-template NAME=${family}\`.

## Marche a suivre

1. Deposez votre image d'apercu (JPEG ou PNG, 5 Mo maximum) dans \`assets/\` et
   pointez le champ \`preview\` du manifeste vers elle (\`assets/apercu.png\` par
   defaut, mais le nom est libre). C'est elle qui illustrera le template au catalogue.
2. Modifiez \`manifest.json\` : libelle, description, blocs.
3. Empaquetez : \`make pack-badge-template NAME=${family}\`
4. Installez l'archive obtenue depuis \`/platform/badge-templates\`.

## Format du manifeste

Toutes les coordonnees et dimensions (tailles de police comprises) sont en
**pixels a 300 dpi** (1 px = 1/300 pouce ; une carte CR80 paysage fait 1011 × 638 px),
positionnees en absolu depuis le coin superieur gauche de la page. Reportez telles
quelles les valeurs de votre maquette print 300 dpi.

### Types de blocs

| Type | Role | Champs propres |
|---|---|---|
| \`text\` | Un texte | \`text\` (gabarit), \`style\` |
| \`image\` | Une image | \`source\` **ou** \`asset\`, jamais les deux ; \`radiusPx\` |
| \`qr\` | Le QR code du badge | aucun |
| \`rect\` | Un aplat | \`fill\`, \`radiusPx\`, \`borderTopPx\`, \`borderColor\` |

### Gabarits de texte

Le champ \`text\` melange litteraux et references : les segments \`{chemin}\` sont
remplaces par la valeur, le reste est ecrit tel quel.

    "{participant.firstName} {participant.lastName}"   ->  Awa Diallo
    "#{badge.id}"                                       ->  #BDG-1
    "Participant anonyme"                               ->  Participant anonyme

### Sources disponibles

| Chemin | Type |
|---|---|
| \`participant.firstName\`, \`participant.lastName\`, \`participant.structure\` | texte |
| \`participant.photoDataUrl\` | image |
| \`category.name\` | texte |
| \`category.color\` | couleur |
| \`category.neutralBadge\`, \`category.anonymous\` | booleen |
| \`event.title\`, \`event.location\` | texte |
| \`event.date\` | date |
| \`event.logoDataUrl\` | image |
| \`badge.id\`, \`badge.verifyUrl\` | texte |
| \`badge.qrCodeDataUrl\` | image |

\`fill\` et \`color\` acceptent une couleur hexadecimale (\`#4f46e5\`) ou un chemin de
source de type couleur (\`category.color\`).

### Conditions d'affichage

\`visibleIf\` accepte une condition, ou une liste dont **toutes** doivent etre vraies :

    "visibleIf": [
      { "path": "category.anonymous", "equals": false },
      { "path": "participant.photoDataUrl", "isEmpty": false }
    ]

\`equals\` ne s'applique qu'a \`category.anonymous\` et \`category.neutralBadge\`.
\`isEmpty\` teste l'absence de valeur sur n'importe quelle source : c'est ainsi qu'on
affiche un bloc de repli quand le participant n'a pas de photo.

### Debordement du texte

La mise en page etant absolue, un texte trop long ne se replace pas seul :

| \`overflow\` | Effet |
|---|---|
| \`shrink\` | Reduit la police jusqu'a \`minSizePx\` (obligatoire dans ce mode) |
| \`truncate\` | Coupe et ajoute une ellipse |
| \`clip\` | Laisse deborder |

### Polices

Montserrat est la police par defaut. Pour en embarquer une autre, deposez le fichier
dans \`fonts/\` (TTF ou OTF, 2 Mo maximum) et declarez-la :

    "fonts": [{ "alias": "titre", "file": "fonts/Inter-Bold.ttf", "weight": 700 }]

puis referencez \`"font": "titre"\` dans le style d'un bloc texte.

### Images

**JPEG et PNG uniquement** : le moteur PDF ne lit pas le WebP.
`;

export function createSkeleton(name: string, root: string): string {
  if (!SLUG.test(name)) {
    throw new Error(`"${name}" n'est pas un slug valide (attendu : minuscules-et-tirets).`);
  }
  const dir = resolve(root, name);
  if (existsSync(dir)) {
    throw new Error(`le dossier "${dir}" existe deja : choisissez un autre nom.`);
  }

  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifestOf(name), null, 2)}\n`);
  writeFileSync(join(dir, "README.md"), README(name));
  return dir;
}

/* v8 ignore start -- point d'entree CLI, exerce par `make new-badge-template` */
function main(): void {
  const name = process.env.NAME;
  if (!name) {
    console.error("Usage : make new-badge-template NAME=<slug>");
    process.exitCode = 1;
    return;
  }
  try {
    const dir = createSkeleton(name, resolve("badge-templates"));
    console.log(`Squelette cree : ${dir}`);
    console.log("  1. Deposez votre image d'apercu dans assets/ (champ preview du manifeste)");
    console.log("  2. Modifiez manifest.json");
    console.log(`  3. make pack-badge-template NAME=${name}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("new-badge-template.ts")) {
  main();
}
/* v8 ignore stop */
