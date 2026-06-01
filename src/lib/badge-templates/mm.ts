// Conversion millimetres -> points React-PDF (1mm = 2.83464567pt).
// Utilise par les templates pour exprimer les dimensions en mm tout en
// produisant des pages au bon format.
export function mm(valueMm: number): number {
  return valueMm * 2.83464567;
}
