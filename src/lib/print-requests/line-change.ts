import { formatFcfa } from "./labels";

// Module pur (aucun import serveur) : utilisable par le fil de discussion côté navigateur.
export type LineChange = {
  op: "ADDED" | "UPDATED" | "REMOVED";
  lineId: string;
  label: string;
  from?: { quantity: number; unitPrice: number };
  to?: { quantity: number; unitPrice: number };
};

// Valeurs par défaut sûres : un `details` mal formé ne produit ni « NaN FCFA » ni « undefined ».
export const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const txt = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "—");
const qp = (v?: { quantity: number; unitPrice: number }) => ({
  quantity: num(v?.quantity),
  unitPrice: num(v?.unitPrice),
});

export function describeLineChange(c: LineChange): string {
  const label = txt(c.label);
  if (c.op === "ADDED") {
    const to = qp(c.to);
    return `Ligne ajoutée : ${label} (${to.quantity} × ${formatFcfa(to.unitPrice)})`;
  }
  if (c.op === "REMOVED") return `Ligne retirée : ${label}`;
  const from = qp(c.from);
  const to = qp(c.to);
  const parts: string[] = [];
  if (from.quantity !== to.quantity) parts.push(`quantité ${from.quantity} → ${to.quantity}`);
  if (from.unitPrice !== to.unitPrice) {
    parts.push(`prix unitaire ${formatFcfa(from.unitPrice)} → ${formatFcfa(to.unitPrice)}`);
  }
  // Changement d'intitulé seul : aucune différence de quantité ni de prix à détailler.
  return parts.length > 0 ? `Ligne modifiée : ${label} (${parts.join(", ")})` : `Ligne modifiée : ${label}`;
}
