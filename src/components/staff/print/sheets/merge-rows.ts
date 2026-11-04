// Fusion d'un rafraichissement (polling) dans la page visible : l'ensemble et l'ordre des lignes
// affichees sont conserves, seules leurs valeurs sont mises a jour. Le rafraichissement porte
// sur la liste complete (API non paginee) : ses lignes hors page sont ignorees.
export function mergeRows<T>(visible: T[], fresh: T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map(fresh.map((row) => [keyOf(row), row]));
  return visible.map((row) => byKey.get(keyOf(row)) ?? row);
}

export function mergeRowsById<T extends { id: string }>(visible: T[], fresh: T[]): T[] {
  return mergeRows(visible, fresh, (row) => row.id);
}
