import { html } from "/vendor/preact-htm.mjs";
import { readAsDataUrl } from "/ui/api.js";

// Formulaire du contexte de previsualisation. Il produit un ContextInput partiel
// (voir studio/context.ts) : les champs vides retombent sur les defauts du serveur.
// Les images choisies restent en memoire du navigateur, sous forme de data URL :
// elles alimentent l'apercu sans jamais entrer dans le paquet.

function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`;
}

function Text({ label, value, onValue, type = "text" }) {
  return html`
    <${Field} label=${label}>
      <input type=${type} value=${value ?? ""} onInput=${(e) => onValue(e.target.value)} />
    <//>
  `;
}

function Toggle({ label, checked, onValue }) {
  return html`
    <label class="toggle">
      <input type="checkbox" checked=${checked ?? false} onChange=${(e) => onValue(e.target.checked)} />
      <span>${label}</span>
    </label>
  `;
}

function ImagePicker({ label, value, onValue }) {
  return html`
    <${Field} label=${label}>
      <span class="row">
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange=${async (e) => {
            const file = e.target.files?.[0];
            if (file) onValue(await readAsDataUrl(file));
          }}
        />
        ${value ? html`<button type="button" onClick=${() => onValue("")}>Retirer</button>` : null}
      </span>
    <//>
  `;
}

// La date circule en ISO dans le contexte ; l'input HTML veut "AAAA-MM-JJ".
function isoToDateInput(iso) {
  return typeof iso === "string" ? iso.slice(0, 10) : "";
}

export function ContextForm({ context, schemaInfo, onChange }) {
  const value = context ?? {};
  const patch = (section, changes) =>
    onChange({ ...value, [section]: { ...(value[section] ?? {}), ...changes } });

  return html`
    <div class="form">
      <section>
        <h2>Préréglages</h2>
        <div class="row wrap">
          ${(schemaInfo?.presets ?? []).map(
            (preset) => html`
              <button type="button" onClick=${() => onChange(preset.input)}>${preset.label}</button>
            `,
          )}
        </div>
      </section>

      <section>
        <h2>Participant</h2>
        <${Text}
          label="Prénom"
          value=${value.participant?.firstName}
          onValue=${(v) => patch("participant", { firstName: v })}
        />
        <${Text}
          label="Nom"
          value=${value.participant?.lastName}
          onValue=${(v) => patch("participant", { lastName: v })}
        />
        <${Text}
          label="Structure"
          value=${value.participant?.structure}
          onValue=${(v) => patch("participant", { structure: v })}
        />
        <${ImagePicker}
          label="Photo"
          value=${value.participant?.photoDataUrl}
          onValue=${(v) => patch("participant", { photoDataUrl: v })}
        />
      </section>

      <section>
        <h2>Catégorie</h2>
        <${Text}
          label="Libellé"
          value=${value.category?.name}
          onValue=${(v) => patch("category", { name: v })}
        />
        <${Text}
          label="Couleur"
          type="color"
          value=${value.category?.color ?? "#4f46e5"}
          onValue=${(v) => patch("category", { color: v })}
        />
        <${Toggle}
          label="Badge anonyme"
          checked=${value.category?.anonymous}
          onValue=${(v) => patch("category", { anonymous: v })}
        />
        <${Toggle}
          label="Badge neutre"
          checked=${value.category?.neutralBadge}
          onValue=${(v) => patch("category", { neutralBadge: v })}
        />
      </section>

      <section>
        <h2>Événement</h2>
        <${Text}
          label="Titre"
          value=${value.event?.title}
          onValue=${(v) => patch("event", { title: v })}
        />
        <${Text}
          label="Lieu"
          value=${value.event?.location}
          onValue=${(v) => patch("event", { location: v })}
        />
        <${Text}
          label="Date"
          type="date"
          value=${isoToDateInput(value.event?.date)}
          onValue=${(v) => patch("event", { date: v ? new Date(v).toISOString() : undefined })}
        />
        <${ImagePicker}
          label="Logo"
          value=${value.event?.logoDataUrl}
          onValue=${(v) => patch("event", { logoDataUrl: v || null })}
        />
      </section>

      <section>
        <h2>Badge</h2>
        <${Text}
          label="Identifiant"
          value=${value.badge?.id}
          onValue=${(v) => patch("badge", { id: v })}
        />
        <${Text}
          label="URL de vérification (QR)"
          value=${value.badge?.verifyUrl}
          onValue=${(v) => patch("badge", { verifyUrl: v })}
        />
      </section>
    </div>
  `;
}
