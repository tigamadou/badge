import type { BadgeSelection } from "@/lib/print-requests/inputs";

// Forme renvoyée par GET …/print-requests/{id}/registrations (CandidateRow côté serveur).
export type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  categoryId: string;
  categoryName: string;
  categoryNumber: number;
  printed: boolean;
  reservedBy: string | null;
  selected: boolean;
};

export type SelectionMode = BadgeSelection["mode"];

export type SelectionState = {
  mode: SelectionMode;
  categoryIds: string[];
  registrationIds: string[];
};

// Badges que la commande peut encore prendre : ceux déjà réservés par une autre commande sont exclus.
export const isAvailable = (c: Candidate): boolean => c.reservedBy === null;

// Comme le serveur (content.ts) : les modes ALL_AVAILABLE et CATEGORIES laissent de côté les
// badges déjà imprimés ; seule la sélection manuelle (IDS) peut en reprendre un.
export function selectedCandidates(candidates: Candidate[], state: SelectionState): Candidate[] {
  const available = candidates.filter(isAvailable);
  const unprinted = available.filter((c) => !c.printed);
  if (state.mode === "ALL_AVAILABLE") return unprinted;
  if (state.mode === "CATEGORIES") return unprinted.filter((c) => state.categoryIds.includes(c.categoryId));
  return available.filter((c) => state.registrationIds.includes(c.id));
}

// Sélection à envoyer à l'API, ou null si rien n'est sélectionné.
export function buildSelection(candidates: Candidate[], state: SelectionState): BadgeSelection | null {
  if (selectedCandidates(candidates, state).length === 0) return null;
  if (state.mode === "ALL_AVAILABLE") return { mode: "ALL_AVAILABLE" };
  if (state.mode === "CATEGORIES") return { mode: "CATEGORIES", categoryIds: state.categoryIds };
  return {
    mode: "IDS",
    registrationIds: selectedCandidates(candidates, state).map((c) => c.id),
  };
}

// Recherche manuelle : nom, prénom ou catégorie, sans tenir compte de la casse ni des accents.
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterCandidates(candidates: Candidate[], query: string): Candidate[] {
  const q = fold(query.trim());
  if (!q) return candidates;
  return candidates.filter((c) => fold(`${c.firstName} ${c.lastName} ${c.categoryName}`).includes(q));
}

// État de départ : la commande a déjà des badges (sélection manuelle) ou non (tous les disponibles).
export function initialSelectionState(candidates: Candidate[]): SelectionState {
  const ids = candidates.filter((c) => c.selected).map((c) => c.id);
  return {
    mode: ids.length > 0 ? "IDS" : "ALL_AVAILABLE",
    categoryIds: [],
    registrationIds: ids,
  };
}
