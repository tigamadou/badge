// Conversion pixels 96 dpi -> points React-PDF (1px = 72/96 pt = 0.75pt).
// Le manifeste declaratif exprime toutes ses dimensions en pixels CSS a 96 dpi
// (la convention de Figma et du web) : l'auteur reporte telles quelles les
// valeurs de sa maquette, tout en produisant des pages PDF au bon format
// physique d'impression.
export function px(valuePx: number): number {
  return valuePx * 0.75;
}
