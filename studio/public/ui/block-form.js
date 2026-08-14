import { html } from "/vendor/preact-htm.mjs";
import {
  ColorField,
  Field,
  NumField,
  Segmented,
  Select,
  Slider,
  Toggles,
  XYWH,
} from "/ui/controls.js";

// Inspecteur d'un bloc. Les parametres sont regroupes PAR FONCTION — identite,
// disposition, apparence, coins et bordures, typographie, contenu, conditions —
// toujours dans le meme ordre, pour qu'on sache ou regarder sans chercher.
// Toute modification remonte le bloc entier : l'application reserialise ensuite le
// manifeste, seule source de verite.

function Section({ title, children }) {
  return html`<h3 class="panel-title">${title}</h3>
    ${children}`;
}

function BorderEditor({ label, value, colorSources, onValue }) {
  if (!value) {
    return html`
      <div class="row">
        <button type="button" onClick=${() => onValue({ widthPx: 1, color: "#000000" })}>
          + ${label}
        </button>
      </div>
    `;
  }
  return html`
    <fieldset>
      <legend>${label} <button type="button" onClick=${() => onValue(undefined)}>✕</button></legend>
      <${NumField}
        label="Épaisseur"
        value=${value.widthPx}
        step="0.5"
        onValue=${(v) => onValue({ ...value, widthPx: v ?? 0 })}
      />
      <${ColorField}
        label="Couleur"
        value=${value.color}
        colorSources=${colorSources}
        onValue=${(v) => onValue({ ...value, color: v ?? "#000000" })}
      />
      <${Segmented}
        label="Style"
        value=${value.style ?? "solid"}
        allowNone=${false}
        options=${[
          { value: "solid", label: "───" },
          { value: "dashed", label: "╌╌╌" },
          { value: "dotted", label: "┈┈┈" },
        ]}
        onValue=${(v) => onValue({ ...value, style: v })}
      />
    </fieldset>
  `;
}

function RadiusEditor({ value, onValue }) {
  const byCorner = typeof value === "object" && value !== null;
  return html`
    <fieldset>
      <legend>
        Coins
        <label class="toggle">
          <input
            type="checkbox"
            checked=${byCorner}
            onChange=${(e) => onValue(e.target.checked ? {} : undefined)}
          />
          <span>par coin</span>
        </label>
      </legend>
      ${byCorner
        ? ["topLeft", "topRight", "bottomRight", "bottomLeft"].map(
            (corner) => html`
              <${NumField}
                label=${corner}
                value=${value[corner]}
                onValue=${(v) => onValue({ ...value, [corner]: v })}
              />
            `,
          )
        : html`<${NumField} label="Rayon" value=${value} onValue=${onValue} />`}
    </fieldset>
  `;
}

function VisibleIfEditor({ value, schemaInfo, onValue }) {
  const conditions = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const update = (next) => onValue(next.length === 0 ? undefined : next);
  const sources = Object.keys(schemaInfo?.sources ?? {});
  const conditionPaths = schemaInfo?.conditionPaths ?? [];

  const kindOf = (c) =>
    "equals" in c
      ? c.equals
        ? "equals-true"
        : "equals-false"
      : c.isEmpty
        ? "is-empty"
        : "not-empty";
  const applyKind = (path, kind) =>
    kind === "equals-true"
      ? { path, equals: true }
      : kind === "equals-false"
        ? { path, equals: false }
        : { path, isEmpty: kind === "is-empty" };

  return html`
    <fieldset>
      <legend>Conditions d'affichage</legend>
      ${conditions.map(
        (condition, i) => html`
          <div class="row">
            <select
              value=${condition.path}
              onChange=${(e) =>
                update(conditions.map((c, j) => (j === i ? { ...c, path: e.target.value } : c)))}
            >
              ${("equals" in condition ? conditionPaths : sources).map(
                (p) => html`<option value=${p}>${p}</option>`,
              )}
            </select>
            <select
              value=${kindOf(condition)}
              onChange=${(e) =>
                update(conditions.map((c, j) => (j === i ? applyKind(c.path, e.target.value) : c)))}
            >
              <option value="equals-true">est vrai</option>
              <option value="equals-false">est faux</option>
              <option value="is-empty">est vide</option>
              <option value="not-empty">n'est pas vide</option>
            </select>
            <button type="button" onClick=${() => update(conditions.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        `,
      )}
      <button
        type="button"
        onClick=${() =>
          update([...conditions, { path: conditionPaths[0] ?? "category.anonymous", equals: true }])}
      >
        + condition
      </button>
    </fieldset>
  `;
}

export function BlockForm({ block, schemaInfo, pageCount, assets, fonts, onChange, isRoot = true }) {
  const patch = (changes) => onChange({ ...block, ...changes });
  const style = block.style ?? {};
  const patchStyle = (changes) => patch({ style: { ...style, ...changes } });

  const sources = schemaInfo?.sources ?? {};
  const colorSources = Object.keys(sources).filter((p) => sources[p] === "color");
  const imageSources = Object.keys(sources).filter((p) => sources[p] === "image");

  const isShape = block.type === "rect" || block.type === "square" || block.type === "circle";
  const isText = block.type === "text";
  const isGroup = block.type === "group";

  const ratio = schemaInfo?.minTextHeightRatio ?? 1.45;
  const tooShort = isText && style.sizePx && block.h < style.sizePx * ratio;

  return html`
    <div class="block-form">
      <${Section} title="Identité">
        <${Field} label="Nom">
          <input
            type="text"
            value=${block.name ?? ""}
            placeholder=${block.type}
            onInput=${(e) => patch({ name: e.target.value || undefined })}
          />
        <//>
        <${Field} label="Type"><input type="text" value=${block.type} readonly /><//>
        ${isRoot
          ? html`<${Select}
              label="Page"
              value=${block.page}
              options=${Array.from({ length: pageCount }, (_, i) => i + 1)}
              allowEmpty=${false}
              onValue=${(v) => patch({ page: Number(v) })}
            />`
          : null}
      <//>

      <${Section} title="Disposition">
        <${XYWH} block=${block} onPatch=${patch} />
        <${Slider}
          label="Rotation"
          value=${block.rotate ?? 0}
          min=${-180}
          max=${180}
          format=${(v) => `${v}°`}
          onValue=${(v) => patch({ rotate: v === 0 ? undefined : v })}
        />
      <//>

      <${Section} title="Apparence">
        <${Slider}
          label="Opacité"
          value=${block.opacity === undefined ? 100 : Math.round(block.opacity * 100)}
          format=${(v) => `${v} %`}
          onValue=${(v) => patch({ opacity: v === 100 ? undefined : v / 100 })}
        />
        ${isShape
          ? html`
              <${ColorField}
                label="Fond couleur"
                value=${block.fill}
                colorSources=${colorSources}
                onValue=${(v) => patch({ fill: v })}
              />
              <${Select}
                label="Image (source)"
                value=${block.image?.source}
                options=${imageSources}
                onValue=${(v) =>
                  patch({ image: v ? { ...block.image, source: v, asset: undefined } : undefined })}
              />
              <${Select}
                label="Image (paquet)"
                value=${block.image?.asset}
                options=${assets}
                onValue=${(v) =>
                  patch({ image: v ? { ...block.image, asset: v, source: undefined } : undefined })}
              />
              ${block.image
                ? html`<${Segmented}
                    label="Cadrage"
                    value=${block.image.fit ?? "cover"}
                    allowNone=${false}
                    options=${[
                      { value: "cover", label: "Remplir" },
                      { value: "contain", label: "Inscrire" },
                      { value: "fill", label: "Étirer" },
                    ]}
                    onValue=${(v) => patch({ image: { ...block.image, fit: v } })}
                  />`
                : null}
            `
          : null}
      <//>

      ${isGroup
        ? null
        : html`
            <${Section} title="Coins et bordures">
              ${block.type === "circle"
                ? null
                : html`<${RadiusEditor}
                    value=${block.radiusPx}
                    onValue=${(v) => patch({ radiusPx: v })}
                  />`}
              <${BorderEditor}
                label="Bordure"
                value=${block.border}
                colorSources=${colorSources}
                onValue=${(v) => patch({ border: v })}
              />
              ${["borderTop", "borderRight", "borderBottom", "borderLeft"].map(
                (side) => html`
                  <${BorderEditor}
                    label=${side}
                    value=${block[side]}
                    colorSources=${colorSources}
                    onValue=${(v) => patch({ [side]: v })}
                  />
                `,
              )}
            <//>
          `}

      ${isText
        ? html`
            <${Section} title="Typographie">
              ${tooShort
                ? html`<p class="warning">
                    ⚠ Cadre trop bas : le texte ne s'affichera pas (h ≥ ${ratio} × police).
                  </p>`
                : null}
              <${NumField}
                label="Taille"
                value=${style.sizePx}
                onValue=${(v) => patchStyle({ sizePx: v ?? 16 })}
              />
              <${NumField}
                label="Taille mini"
                value=${style.minSizePx}
                onValue=${(v) => patchStyle({ minSizePx: v })}
              />
              <${Select}
                label="Police"
                value=${style.font}
                options=${fonts.map((f) => f.alias)}
                onValue=${(v) => patchStyle({ font: v })}
              />
              <${Segmented}
                label="Graisse"
                value=${style.weight}
                options=${[
                  { value: 400, label: "400" },
                  { value: 500, label: "500" },
                  { value: 600, label: "600" },
                  { value: 700, label: "700" },
                ]}
                onValue=${(v) => patchStyle({ weight: v })}
              />
              <${Toggles}
                label="Style"
                items=${[
                  {
                    label: "I",
                    title: "Italique",
                    active: style.fontStyle === "italic",
                    onToggle: () =>
                      patchStyle({ fontStyle: style.fontStyle === "italic" ? undefined : "italic" }),
                  },
                  {
                    label: "U",
                    title: "Souligné",
                    active: style.decoration === "underline",
                    onToggle: () =>
                      patchStyle({
                        decoration: style.decoration === "underline" ? undefined : "underline",
                      }),
                  },
                  {
                    label: "S",
                    title: "Barré",
                    active: style.decoration === "line-through",
                    onToggle: () =>
                      patchStyle({
                        decoration:
                          style.decoration === "line-through" ? undefined : "line-through",
                      }),
                  },
                ]}
              />
              <${ColorField}
                label="Couleur"
                value=${style.color}
                colorSources=${colorSources}
                onValue=${(v) => patchStyle({ color: v ?? "#000000" })}
              />
              <${Segmented}
                label="Alignement"
                value=${style.align}
                options=${[
                  { value: "left", label: "⇤", title: "Gauche" },
                  { value: "center", label: "↔", title: "Centré" },
                  { value: "right", label: "⇥", title: "Droite" },
                  { value: "justify", label: "≡", title: "Justifié" },
                ]}
                onValue=${(v) => patchStyle({ align: v })}
              />
              <${Segmented}
                label="Casse"
                value=${style.transform}
                options=${[
                  { value: "uppercase", label: "AA" },
                  { value: "lowercase", label: "aa" },
                  { value: "none", label: "Aa" },
                ]}
                onValue=${(v) => patchStyle({ transform: v })}
              />
              <${NumField}
                label="Interlettrage"
                value=${style.letterSpacing}
                step="0.1"
                onValue=${(v) => patchStyle({ letterSpacing: v })}
              />
              <${NumField}
                label="Interligne"
                value=${style.lineHeight}
                step="0.1"
                onValue=${(v) => patchStyle({ lineHeight: v })}
              />
            <//>

            <${Section} title="Contenu">
              <${Field} label="Gabarit">
                <input
                  type="text"
                  value=${block.text ?? ""}
                  onInput=${(e) => patch({ text: e.target.value })}
                />
              <//>
              <${Segmented}
                label="Débordement"
                value=${style.overflow}
                allowNone=${false}
                options=${[
                  { value: "shrink", label: "Réduire" },
                  { value: "truncate", label: "Couper" },
                  { value: "clip", label: "Laisser" },
                ]}
                onValue=${(v) => patchStyle({ overflow: v ?? "clip" })}
              />
              <${NumField}
                label="Lignes max"
                value=${style.maxLines}
                onValue=${(v) => patchStyle({ maxLines: v })}
              />
              <${ColorField}
                label="Fond du cadre"
                value=${style.backgroundColor}
                colorSources=${colorSources}
                onValue=${(v) => patchStyle({ backgroundColor: v })}
              />
              <${NumField}
                label="Marge interne"
                value=${style.paddingPx}
                onValue=${(v) => patchStyle({ paddingPx: v })}
              />
            <//>
          `
        : null}

      <${Section} title="Conditions">
        <${VisibleIfEditor}
          value=${block.visibleIf}
          schemaInfo=${schemaInfo}
          onValue=${(v) => patch({ visibleIf: v })}
        />
      <//>
    </div>
  `;
}
