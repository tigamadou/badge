// Conversions d'unites pour les planches d'impression (sans import serveur).

// Les formats sont stockes en dixiemes de mm (entiers) en base.
export function tenthsToMm(n: number): number {
  return n / 10;
}

export function mmToTenths(mm: number): number {
  return Math.round(mm * 10);
}

// Pixel CSS (96 dpi) vers millimetres.
export function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

// Millimetres vers points PDF (72 dpi).
export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}
