export type Overflow = "shrink" | "truncate" | "clip";

export type FontWeight = 400 | 500 | 600 | 700;

// Toutes les dimensions du manifeste sont en pixels CSS a 96 dpi (1px = 0,75pt PDF),
// y compris les tailles de police : l'auteur d'un template reporte telles quelles
// les valeurs de sa maquette Figma, sans conversion.
export type TextStyle = {
  font?: string;
  sizePx: number;
  weight?: FontWeight;
  align?: "left" | "center" | "right";
  color: string;
  overflow: Overflow;
  minSizePx?: number;
  transform?: "uppercase" | "lowercase" | "none";
  letterSpacing?: number;
  lineHeight?: number;
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

type BlockBase = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
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
  radiusPx?: number;
};

export type QrBlock = BlockBase & { type: "qr" };

export type RectBlock = BlockBase & {
  type: "rect";
  fill: string;
  radiusPx?: number;
  borderTopPx?: number;
  borderColor?: string;
};

export type Block = TextBlock | ImageBlock | QrBlock | RectBlock;

export type FontDeclaration = { alias: string; file: string; weight?: FontWeight };

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
