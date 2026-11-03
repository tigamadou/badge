// État de l'option « Pendant l'évènement » de l'assistant, selon la réponse de la route d'éligibilité.
export type OnsiteEligibilityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; eligible: boolean };

export const ONSITE_NOT_ELIGIBLE_MESSAGE = "Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place.";

// Désactivée pendant le chargement et quand le modèle est inadapté. Une erreur réseau ne bloque
// pas l'option : le serveur refuse de toute façon l'envoi (409) si le modèle ne convient pas.
// Le type « En amont » n'en dépend jamais.
export function onsiteOptionState(state: OnsiteEligibilityState): { disabled: boolean; showNotice: boolean } {
  if (state.status === "loading") return { disabled: true, showNotice: false };
  if (state.status === "error") return { disabled: false, showNotice: false };
  return { disabled: !state.eligible, showNotice: !state.eligible };
}
