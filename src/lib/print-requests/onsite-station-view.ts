import type { StaffRole } from "@prisma/client";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import type { Permission } from "@/lib/permissions/catalog";
import type { OnsiteCounter } from "./onsite-counter";

// Logique pure du poste d'impression sur place (libellés du compteur, traduction des refus).
// Ne pas importer `./onsite` (il tire Prisma) : le module doit rester utilisable côté navigateur.
// Les messages français viennent du corps de la réponse (`message`, voir ONSITE_ERROR_MESSAGES).

export type CounterTone = "ok" | "warn" | "err";

export type CounterView = {
  summary: string;
  /** Remplissage de la barre, borné à 0-100. */
  pct: number;
  tone: CounterTone;
  notice: string | null;
};

export function counterView(counter: OnsiteCounter): CounterView {
  const { printed, ordered, cap, beyondOrder, level } = counter;
  const pct = ordered > 0 ? Math.min(100, (printed / ordered) * 100) : 0;
  const summary = `${printed} / ${ordered} badges imprimés`;
  switch (level) {
    case "CAP_REACHED":
      return { summary, pct, tone: "err", notice: `Plafond atteint (${cap}) : l'impression est bloquée` };
    case "OVER":
      return {
        summary,
        pct,
        tone: "warn",
        notice: `${beyondOrder} badge${beyondOrder > 1 ? "s" : ""} au-delà de la commande, facturé${beyondOrder > 1 ? "s" : ""} après l'évènement`,
      };
    case "WARNING":
      return { summary, pct, tone: "warn", notice: "90 % de la commande atteinte" };
    default:
      return { summary, pct, tone: "ok", notice: null };
  }
}

export type OnsiteRefusal = { kind: "REPRINT" | "REFUSED"; message: string };

const FALLBACK = "Opération impossible. Réessayez.";
const STATUS_LABELS: Record<string, string> = { PENDING: "en attente", REJECTED: "refusée" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** « Déjà imprimé le … » (date ISO) ; sans date exploitable : « Déjà imprimé ». */
export function alreadyPrintedLabel(printedAt: unknown): string {
  const date = typeof printedAt === "string" ? new Date(printedAt) : null;
  return date && !Number.isNaN(date.getTime()) ? `Déjà imprimé le ${dateFmt.format(date)}` : "Déjà imprimé";
}

// Traduit le corps d'erreur d'une route du poste (`OnsiteError`) en refus affichable.
// « ALREADY_PRINTED » n'est pas un refus définitif : il propose la réimpression.
export function onsiteRefusal(body: unknown): OnsiteRefusal {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const code = typeof b.error === "string" ? b.error : "";
  if (code === "ALREADY_PRINTED") return { kind: "REPRINT", message: alreadyPrintedLabel(b.printedAt) };
  if (code === "NOT_APPROVED") {
    const status = typeof b.status === "string" ? STATUS_LABELS[b.status] : undefined;
    const detail = status ? ` (${status})` : "";
    return { kind: "REFUSED", message: `Inscription non approuvée${detail} : le poste n'approuve personne.` };
  }
  return { kind: "REFUSED", message: typeof b.message === "string" && b.message !== "" ? b.message : FALLBACK };
}

export async function fetchOnsiteRefusal(res: Response): Promise<OnsiteRefusal> {
  return onsiteRefusal(await res.json().catch(() => null));
}

const COUNTER_STATUSES = ["PAID", "IN_PRODUCTION", "READY", "COMPLETED"];
const STATION_STATUSES = ["PAID", "IN_PRODUCTION", "READY"];

/** Le compteur n'a de sens qu'à partir du paiement. */
export const showsOnsiteCounter = (status: string) => COUNTER_STATUSES.includes(status);
export const canOpenOnsiteStation = (status: string) => STATION_STATUSES.includes(status);
// `access` : ensemble de permissions ; la branche `StaffRole` est @deprecated compat chantier roles-permissions (retiré à la fusion).
export const canSetOnsiteMargin = (status: string, access: StaffRole | ReadonlySet<Permission>) =>
  STATION_STATUSES.includes(status) &&
  (typeof access === "string" ? staffRoleAtLeast(access, "STAFF_ADMIN") : access.has("print.onsite.margin.update"));
