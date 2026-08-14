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
//  - `equals` compare un chemin booleen a une valeur (badge anonyme, badge neutre) ;
//  - `isEmpty` teste l'absence d'une valeur, ce qui permet les blocs de repli
//    (placeholder gris quand le participant n'a pas de photo).
export type Condition =
  | { path: string; equals: boolean }
  | { path: string; isEmpty: boolean };

// Une condition seule, ou une liste dont TOUTES doivent etre vraies. La photo du
// participant s'affiche si le badge n'est pas anonyme ET que la photo existe : sans
// conjonction, ce cas ne serait pas exprimable.
export type VisibleIf = Condition | Condition[];

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
  page: number;
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
// contexte, le reste est litteral. Permet « {participant.firstName} {participant.lastName} »
// ou « #{badge.id} » sans multiplier les blocs.
export type TextBlock = BlockBase & { type: "text"; text: string; style: TextStyle };

export type ImageBlock = BlockBase & {
  type: "image";
  source?: string;
  asset?: string;
  // Cadrage de l'image dans son bloc : `cover` remplit quitte a rogner (defaut),
  // `contain` inscrit l'image entiere, `fill` etire. Un logo se declare `contain`.
  objectFit?: "cover" | "contain" | "fill";
};

export type QrBlock = BlockBase & { type: "qr" };

export type RectBlock = BlockBase & {
  type: "rect";
  fill: string;
};

// Un carre exige w = h ; le radiusPx reste permis (carre arrondi).
export type SquareBlock = BlockBase & { type: "square"; fill: string };

// Un cercle a un rayon implicite (min(w,h)/2) : radiusPx n'y est pas admis, et une
// largeur differente de la hauteur donne une ellipse.
export type CircleBlock = BlockBase & { type: "circle"; fill: string };

export type Block =
  | TextBlock
  | ImageBlock
  | QrBlock
  | RectBlock
  | SquareBlock
  | CircleBlock;

export type FontDeclaration = {
  alias: string;
  file: string;
  weight?: FontWeight;
  style?: "normal" | "italic";
};

export type TemplateManifest = {
  formatVersion: 1;
  family: string;
  label: string;
  description: string;
  // Image d'apercu du badge, fournie par l'auteur du paquet et affichee au catalogue.
  // Optionnelle : sans elle, l'interface montre un placeholder.
  preview?: string;
  page: { widthPx: number; heightPx: number; count: number };
  fonts?: FontDeclaration[];
  blocks: Block[];
};
