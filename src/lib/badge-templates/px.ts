// Conversion pixels 300 dpi -> points React-PDF (1px = 72/300 pt = 0.24pt).
// Le manifeste declaratif exprime toutes ses dimensions en pixels a 300 dpi
// (convention des maquettes print) tout en produisant des pages PDF au bon
// format physique d'impression.
export function px(valuePx: number): number {
  return valuePx * 0.24;
}
