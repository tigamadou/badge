import { html } from "/vendor/preact-htm.mjs";

// Controles reutilisables de l'inspecteur, choisis selon la NATURE de la donnee :
// un nombre borne se regle au slider, un choix ferme en segmented, une couleur au
// swatch. Tous sont controles et remontent une valeur, jamais un evenement.

const HEX = /^#[0-9a-fA-F]{6}$/;

export function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`;
}

export function NumField({ label, value, onValue, step = 1, min, max }) {
  return html`
    <${Field} label=${label}>
      <input
        type="number"
        step=${step}
        min=${min}
        max=${max}
        value=${value ?? ""}
        onInput=${(e) => onValue(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    <//>
  `;
}

// Grille compacte a la Figma : X Y sur une ligne, W H sur la suivante.
export function XYWH({ block, onPatch }) {
  const cell = (key, label, fallback) => html`
    <label class="xywh-cell">
      <span>${label}</span>
      <input
        type="number"
        value=${block[key] ?? ""}
        onInput=${(e) =>
          onPatch({ [key]: e.target.value === "" ? fallback : Number(e.target.value) })}
      />
    </label>
  `;
  return html`
    <div class="xywh">
      ${cell("x", "X", 0)} ${cell("y", "Y", 0)} ${cell("w", "L", 1)} ${cell("h", "H", 1)}
    </div>
  `;
}

export function Slider({ label, value, onValue, min = 0, max = 100, step = 1, format }) {
  const shown = value ?? max;
  return html`
    <${Field} label=${label}>
      <span class="slider">
        <input
          type="range"
          min=${min}
          max=${max}
          step=${step}
          value=${shown}
          onInput=${(e) => onValue(Number(e.target.value))}
        />
        <span class="dim">${format ? format(shown) : shown}</span>
      </span>
    <//>
  `;
}

// Choix ferme et court : plus lisible qu'un select, et tout est visible d'un coup.
export function Segmented({ label, value, options, onValue, allowNone = true }) {
  const buttons = html`
    <span class="seg">
      ${options.map(
        (option) => html`
          <button
            type="button"
            class=${value === option.value ? "active" : ""}
            title=${option.title ?? option.label}
            onClick=${() =>
              onValue(allowNone && value === option.value ? undefined : option.value)}
          >
            ${option.label}
          </button>
        `,
      )}
    </span>
  `;
  return label ? html`<${Field} label=${label}>${buttons}<//>` : buttons;
}

// Bascules independantes (italique, souligne, barre) : chacune a son propre etat.
export function Toggles({ label, items }) {
  return html`
    <${Field} label=${label}>
      <span class="seg">
        ${items.map(
          (item) => html`
            <button
              type="button"
              class=${item.active ? "active" : ""}
              title=${item.title}
              onClick=${item.onToggle}
            >
              ${item.label}
            </button>
          `,
        )}
      </span>
    <//>
  `;
}

// Une couleur est soit hexadecimale, soit un chemin de source : le swatch natif ne
// vaut que pour le premier cas, le menu couvre le second.
export function ColorField({ label, value, colorSources = [], onValue }) {
  return html`
    <${Field} label=${label}>
      <span class="row">
        <input
          type="color"
          value=${HEX.test(value ?? "") ? value : "#000000"}
          onInput=${(e) => onValue(e.target.value)}
        />
        <input
          type="text"
          value=${value ?? ""}
          placeholder="#000000"
          onInput=${(e) => onValue(e.target.value || undefined)}
        />
        <select value="" onChange=${(e) => e.target.value && onValue(e.target.value)}>
          <option value="">src…</option>
          ${colorSources.map((path) => html`<option value=${path}>${path}</option>`)}
        </select>
      </span>
    <//>
  `;
}

export function Select({ label, value, options, onValue, allowEmpty = true }) {
  return html`
    <${Field} label=${label}>
      <select value=${value ?? ""} onChange=${(e) => onValue(e.target.value || undefined)}>
        ${allowEmpty ? html`<option value="">—</option>` : null}
        ${options.map(
          (option) =>
            html`<option value=${option.value ?? option}>${option.label ?? option}</option>`,
        )}
      </select>
    <//>
  `;
}

// Depot de fichier : l'input natif est masque derriere un label stylable, et la
// vignette montre ce qui est deja charge.
export function Dropzone({ label, accept, preview, onFile }) {
  return html`
    <label class="dropzone">
      ${preview ? html`<img src=${preview} alt="" />` : null}
      <span>${label}</span>
      <input
        type="file"
        accept=${accept}
        onChange=${(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  `;
}
