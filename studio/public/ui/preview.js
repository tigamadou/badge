import { html, useEffect, useState } from "/vendor/preact-htm.mjs";
import * as api from "/ui/api.js";

const DEBOUNCE_MS = 400;

// Apercu PDF permanent. Un manifeste invalide n'efface PAS le rendu precedent :
// sans cette regle, le cadre clignoterait a chaque accolade ouverte pendant la frappe.
export function Preview({ name, manifestText, context, onErrors, onStatus }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!name || !manifestText) return undefined;
    // Minuteur local a cet effet : le nettoyage annule exactement le rendu que
    // cette execution avait programme.
    let cancelled = false;
    const timer = setTimeout(async () => {
      onStatus?.("Rendu…");
      const res = await api.renderPdf(name, manifestText, context);
      if (cancelled) return;
      if (!res.ok) {
        onErrors(res.errors);
        onStatus?.("Manifeste invalide");
        return;
      }
      onErrors([]);
      onStatus?.("");
      setSrc(URL.createObjectURL(res.blob));
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, manifestText, context]);

  // L'URL d'objet precedente est liberee des qu'une nouvelle la remplace, et la
  // derniere au demontage.
  useEffect(() => () => src && URL.revokeObjectURL(src), [src]);

  return html`
    <section class="preview">
      ${src
        ? html`<object type="application/pdf" data=${src}></object>`
        : html`<p class="placeholder">Aperçu en attente…</p>`}
    </section>
  `;
}
