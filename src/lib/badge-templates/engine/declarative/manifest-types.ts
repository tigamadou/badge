import { DATE_FORMATS, type DateFormat } from "../format-date";

export { DATE_FORMATS };
export type { DateFormat };

// Un manifeste v2 declare son propre vocabulaire : le moteur ne connait plus
// aucun nom metier, et le meme moteur rend un badge comme une facture.
// Source canonique : `schema.ts` (le z.enum) et `server.ts` (le payload
// /api/schema-info) la relisent tous deux, pour qu'un sixieme type n'exige
// jamais qu'une copie a la main.
export const VARIABLE_KINDS = ["text", "image", "boolean", "date", "color"] as const;
export type VariableKind = (typeof VARIABLE_KINDS)[number];

// `sample` alimente l'apercu du studio et le rendu d'epreuve. Pour une variable
// `image`, il designe un chemin de ressource DU PAQUET (« assets/photo-demo.png »),
// valide comme l'est deja `preview` : le JSON reste lisible.
// `format` ne concerne que les variables `date`.
export type VariableDeclaration = {
  name: string;
  kind: VariableKind;
  label: string;
  sample?: string | boolean;
  format?: DateFormat;
};

// Valeurs fournies au rendu, indexees par nom de variable.
export type VariableValues = Record<string, string | boolean>;

// Un jeu de valeurs partiel, propose dans le studio pour eprouver un cas limite
// (sans photo, textes tres longs). Remplace les presets badge autrefois cables
// dans server/context.ts.
export type Preset = { label: string; values: VariableValues };

export type Overflow = "shrink" | "truncate" | "clip";

export type FontWeight = 400 | 500 | 600 | 700;

// Toutes les dimensions du manifeste sont en pixels CSS a 96 dpi (1px = 0,75pt PDF),
// y compris les tailles de police : l'auteur d'un template reporte telles quelles
// les valeurs de sa maquette Figma, sans conversion.
export type TextStyle = {
  font?: string;
  sizePx: number;
  weight?: FontWeight;
  align?: "left" | "center" | "right" | "justify";
  color: string;
  overflow: Overflow;
  minSizePx?: number;
  transform?: "uppercase" | "lowercase" | "none";
  letterSpacing?: number;
  lineHeight?: number;
  fontStyle?: "italic";
  decoration?: "underline" | "line-through";
  // Nombre maximal de lignes rendues, ellipsis au-dela (complete shrink/truncate
  // pour le multiligne).
  maxLines?: number;
  // Fond et marge interne du CADRE du texte : de quoi composer une etiquette.
  backgroundColor?: string;
  paddingPx?: number;
};

// Deux formes de condition :
//  - `equals` compare une variable BOOLEENNE a une valeur ; le schema refuse un
//    `equals` sur une variable d'un autre type ;
//  - `isEmpty` teste l'absence d'une valeur, quel que soit son type, ce qui permet
//    les blocs de repli (placeholder gris quand une variable image est absente).
export type Condition =
  | { variable: string; equals: boolean }
  | { variable: string; isEmpty: boolean };

// Reference vers une condition declaree par le manifeste. `use` ne designe jamais
// une variable, et `variable` jamais une condition : les deux espaces de noms sont
// distincts, donc `estNeutre` peut nommer les deux sans ambiguite.
export type ConditionRef = { use: string };

// Une condition NOMMEE porte exactement ce que porte un visibleIf litteral. Elle
// n'accepte pas de `use` : aucune composition, donc aucun cycle possible et
// aucune detection de cycle a ecrire.
export type NamedCondition = { name: string; when: Condition | Condition[] };

// Une condition seule, ou une liste dont TOUTES doivent etre vraies : un bloc image
// ne s'affiche que si une variable booleenne est vraie ET qu'une autre variable
// n'est pas vide, par exemple. Sans conjonction, ce cas ne serait pas exprimable.
// Chaque entree est soit une condition litterale, soit une reference `{ use }` vers
// une condition nommee du manifeste.
export type VisibleIf = Condition | ConditionRef | Array<Condition | ConditionRef>;

export type BorderStyle = "solid" | "dashed" | "dotted";

// Rayons d'arrondi par coin. `radiusPx` accepte aussi un nombre unique, applique
// aux quatre coins.
export type CornerRadii = {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
};

// Une bordure : largeur en px, couleur (hexadecimale ou source de couleur), style.
export type BorderSide = { widthPx: number; color: string; style?: BorderStyle };

// `rotate` (degres, sens horaire) pivote le bloc autour de son centre : declarer le
// cadre NON pivote (comme dans Figma avant rotation), la rotation s'applique ensuite.
// `opacity` (0 a 1) s'applique au bloc entier.
// `border` couvre les quatre cotes ; un `borderTop`/`Right`/`Bottom`/`Left` prime
// sur lui pour le cote concerne.
type BlockBase = {
  // Nom d'affichage dans le studio ; aucun effet sur le rendu.
  name?: string;
  // Exigee a la racine, interdite sur un enfant de groupe : la page du groupe
  // racine s'applique a tout son arbre.
  page?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  opacity?: number;
  radiusPx?: number | CornerRadii;
  border?: BorderSide;
  borderTop?: BorderSide;
  borderRight?: BorderSide;
  borderBottom?: BorderSide;
  borderLeft?: BorderSide;
  visibleIf?: VisibleIf;
};

// `text` est un gabarit : les segments `{chemin}` sont remplaces par la valeur du
// contexte, le reste est litteral. Permet « {destinataire.prenom} {destinataire.nom} »
// ou « #{document.numero} » sans multiplier les blocs.
export type TextBlock = BlockBase & { type: "text"; text: string; style: TextStyle };

// Fond image d'une forme : une source du contexte OU une ressource du paquet,
// jamais les deux. `fit` cadre l'image dans la forme : `cover` remplit quitte a
// rogner (defaut), `contain` inscrit l'image entiere, `fill` etire.
export type ShapeImage = {
  source?: string;
  asset?: string;
  fit?: "cover" | "contain" | "fill";
};

// Une forme porte un fond : une couleur, une image, ou les deux (la couleur se voit
// alors sous une image `contain` ou transparente). L'image est rognee par la forme.
type ShapeBase = { fill?: string; image?: ShapeImage };

export type RectBlock = BlockBase & ShapeBase & { type: "rect" };

// Un carre exige w = h ; le radiusPx reste permis (carre arrondi).
export type SquareBlock = BlockBase & ShapeBase & { type: "square" };

// Un cercle a un rayon implicite (min(w,h)/2) : radiusPx n'y est pas admis, et une
// largeur differente de la hauteur donne une ellipse.
export type CircleBlock = BlockBase & ShapeBase & { type: "circle" };

// Conteneur : les coordonnees de ses enfants sont RELATIVES a lui. Deplacer,
// pivoter, attenuer ou masquer le groupe agit sur tout son contenu ; l'imbrication
// est libre.
export type GroupBlock = BlockBase & { type: "group"; blocks: Block[] };

export type Block =
  | TextBlock
  | RectBlock
  | SquareBlock
  | CircleBlock
  | GroupBlock;

export type FontDeclaration = {
  alias: string;
  file: string;
  weight?: FontWeight;
  style?: "normal" | "italic";
};

export type TemplateManifest = {
  formatVersion: 2;
  family: string;
  label: string;
  description: string;
  // Image d'apercu du document, fournie par l'auteur du paquet et affichee au
  // catalogue. Optionnelle : sans elle, l'interface montre un placeholder.
  preview?: string;
  page: { widthPx: number; heightPx: number; count: number };
  fonts?: FontDeclaration[];
  // Le vocabulaire du template : c'est lui, et non le code du moteur, qui dit
  // quelles references un bloc peut employer.
  variables: VariableDeclaration[];
  // Regles d'affichage partagees, referencees par visibleIf: { use }. Optionnel :
  // un manifeste v2 qui n'en declare pas reste valide, d'ou formatVersion inchange.
  conditions?: NamedCondition[];
  presets?: Preset[];
  blocks: Block[];
};
