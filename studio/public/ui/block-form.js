import { html } from "/vendor/preact-htm.mjs";

// Formulaire d'un bloc. Toute modification remonte le bloc entier : l'editeur
// reserialise ensuite le manifeste, seule source de verite.

const HEX = /^#[0-9a-fA-F]{6}$/;

function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`;
}

function Num({ label, value, onValue, step = 1 }) {
  return html`
    <${Field} label=${label}>
      <input
        type="number"
        step=${step}
        value=${value ?? ""}
        onInput=${(e) => onValue(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    <//>
  `;
}

function Select({ label, value, options, onValue, allowEmpty = true }) {
  return html`
    <${Field} label=${label}>
      <select value=${value ?? ""} onChange=${(e) => onValue(e.target.value || undefined)}>
        ${allowEmpty ? html`<option value="">—</option>` : null}
        ${options.map((o) => html`<option value=${o.value ?? o}>${o.label ?? o}</option>`)}
      </select>
    <//>
  `;
}

// Une couleur est soit hexadecimale, soit un chemin de source de type couleur :
// la pastille native ne sert donc que dans le premier cas.
function ColorInput({ label, value, colorSources, onValue }) {
  return html`
    <${Field} label=${label}>
      <span class="row">
        <input type="text" value=${value ?? ""} onInput=${(e) => onValue(e.target.value || undefined)} />
        <input
          type="color"
          value=${HEX.test(value ?? "") ? value : "#000000"}
          onInput=${(e) => onValue(e.target.value)}
        />
        <select value="" onChange=${(e) => e.target.value && onValue(e.target.value)}>
          <option value="">source…</option>
          ${colorSources.map((p) => html`<option value=${p}>${p}</option>`)}
        </select>
      </span>
    <//>
  `;
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
      <${Num} label="Épaisseur" value=${value.widthPx} onValue=${(v) => onValue({ ...value, widthPx: v ?? 0 })} step="0.5" />
      <${ColorInput}
        label="Couleur"
        value=${value.color}
        colorSources=${colorSources}
        onValue=${(v) => onValue({ ...value, color: v ?? "#000000" })}
      />
      <${Select}
        label="Style"
        value=${value.style}
        options=${["solid", "dashed", "dotted"]}
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
        Coins arrondis
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
              <${Num}
                label=${corner}
                value=${value[corner]}
                onValue=${(v) => onValue({ ...value, [corner]: v })}
              />
            `,
          )
        : html`<${Num} label="Rayon" value=${value} onValue=${onValue} />`}
    </fieldset>
  `;
}

function VisibleIfEditor({ value, schemaInfo, onValue }) {
  const conditions = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const update = (next) => onValue(next.length === 0 ? undefined : next);
  const sources = Object.keys(schemaInfo?.sources ?? {});
  const conditionPaths = schemaInfo?.conditionPaths ?? [];

  const kindOf = (c) => ("equals" in c ? (c.equals ? "equals-true" : "equals-false") : c.isEmpty ? "is-empty" : "not-empty");
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
                update(
                  conditions.map((c, j) => (j === i ? applyKind(c.path, e.target.value) : c)),
                )}
            >
              <option value="equals-true">est vrai</option>
              <option value="equals-false">est faux</option>
              <option value="is-empty">est vide</option>
              <option value="not-empty">n'est pas vide</option>
            </select>
            <button type="button" onClick=${() => update(conditions.filter((_, j) => j !== i))}>✕</button>
          </div>
        `,
      )}
      <button
        type="button"
        onClick=${() => update([...conditions, { path: conditionPaths[0] ?? "category.anonymous", equals: true }])}
      >
        + condition
      </button>
    </fieldset>
  `;
}

function StyleEditor({ style, fonts, colorSources, onValue }) {
  const patch = (changes) => onValue({ ...style, ...changes });
  return html`
    <fieldset>
      <legend>Style du texte</legend>
      <${Num} label="Taille (px)" value=${style.sizePx} onValue=${(v) => patch({ sizePx: v ?? 16 })} />
      <${Num} label="Taille mini" value=${style.minSizePx} onValue=${(v) => patch({ minSizePx: v })} />
      <${Select}
        label="Police"
        value=${style.font}
        options=${fonts.map((f) => f.alias)}
        onValue=${(v) => patch({ font: v })}
      />
      <${Select}
        label="Graisse"
        value=${style.weight}
        options=${[400, 500, 600, 700]}
        onValue=${(v) => patch({ weight: v ? Number(v) : undefined })}
      />
      <${Select}
        label="Italique"
        value=${style.fontStyle}
        options=${["italic"]}
        onValue=${(v) => patch({ fontStyle: v })}
      />
      <${ColorInput}
        label="Couleur"
        value=${style.color}
        colorSources=${colorSources}
        onValue=${(v) => patch({ color: v ?? "#000000" })}
      />
      <${Select}
        label="Alignement"
        value=${style.align}
        options=${["left", "center", "right", "justify"]}
        onValue=${(v) => patch({ align: v })}
      />
      <${Select}
        label="Débordement"
        value=${style.overflow}
        options=${["shrink", "truncate", "clip"]}
        allowEmpty=${false}
        onValue=${(v) => patch({ overflow: v ?? "clip" })}
      />
      <${Select}
        label="Casse"
        value=${style.transform}
        options=${["uppercase", "lowercase", "none"]}
        onValue=${(v) => patch({ transform: v })}
      />
      <${Select}
        label="Décoration"
        value=${style.decoration}
        options=${["underline", "line-through"]}
        onValue=${(v) => patch({ decoration: v })}
      />
      <${Num} label="Lignes max" value=${style.maxLines} onValue=${(v) => patch({ maxLines: v })} />
      <${Num} label="Interlettrage" value=${style.letterSpacing} onValue=${(v) => patch({ letterSpacing: v })} step="0.1" />
      <${Num} label="Interligne" value=${style.lineHeight} onValue=${(v) => patch({ lineHeight: v })} step="0.1" />
      <${ColorInput}
        label="Fond du texte"
        value=${style.backgroundColor}
        colorSources=${colorSources}
        onValue=${(v) => patch({ backgroundColor: v })}
      />
      <${Num} label="Marge interne" value=${style.paddingPx} onValue=${(v) => patch({ paddingPx: v })} />
    </fieldset>
  `;
}

export function BlockForm({ block, schemaInfo, pageCount, assets, fonts, onChange }) {
  const patch = (changes) => onChange({ ...block, ...changes });
  const sources = schemaInfo?.sources ?? {};
  const colorSources = Object.keys(sources).filter((p) => sources[p] === "color");
  const imageSources = Object.keys(sources).filter((p) => sources[p] === "image");

  const isShape = block.type === "rect" || block.type === "square" || block.type === "circle";

  const ratio = schemaInfo?.minTextHeightRatio ?? 1.45;
  const tooShort =
    block.type === "text" && block.style?.sizePx && block.h < block.style.sizePx * ratio;

  return html`
    <div class="block-form">
      ${tooShort
        ? html`<p class="warning">
            ⚠ Cadre trop bas : le texte ne s'affichera pas (h ≥ ${ratio} × police).
          </p>`
        : null}

      <${Select}
        label="Page"
        value=${block.page}
        options=${Array.from({ length: pageCount }, (_, i) => i + 1)}
        allowEmpty=${false}
        onValue=${(v) => patch({ page: Number(v) })}
      />
      <${Num} label="x" value=${block.x} onValue=${(v) => patch({ x: v ?? 0 })} />
      <${Num} label="y" value=${block.y} onValue=${(v) => patch({ y: v ?? 0 })} />
      <${Num} label="Largeur" value=${block.w} onValue=${(v) => patch({ w: v ?? 1 })} />
      <${Num} label="Hauteur" value=${block.h} onValue=${(v) => patch({ h: v ?? 1 })} />
      <${Num} label="Rotation (°)" value=${block.rotate} onValue=${(v) => patch({ rotate: v })} />
      <${Num} label="Opacité" value=${block.opacity} onValue=${(v) => patch({ opacity: v })} step="0.05" />

      ${block.type === "text"
        ? html`
            <${Field} label="Gabarit">
              <input type="text" value=${block.text} onInput=${(e) => patch({ text: e.target.value })} />
            <//>
            <${StyleEditor}
              style=${block.style ?? {}}
              fonts=${fonts}
              colorSources=${colorSources}
              onValue=${(style) => patch({ style })}
            />
          `
        : null}

      ${isShape
        ? html`
            <${ColorInput}
              label="Fond couleur"
              value=${block.fill}
              colorSources=${colorSources}
              onValue=${(v) => patch({ fill: v })}
            />
            <${Select}
              label="Fond image (source)"
              value=${block.image?.source}
              options=${imageSources}
              onValue=${(v) => patch({ image: v ? { ...block.image, source: v, asset: undefined } : undefined })}
            />
            <${Select}
              label="Fond image (ressource)"
              value=${block.image?.asset}
              options=${assets}
              onValue=${(v) => patch({ image: v ? { ...block.image, asset: v, source: undefined } : undefined })}
            />
            ${block.image
              ? html`
                  <${Select}
                    label="Cadrage"
                    value=${block.image.fit}
                    options=${["cover", "contain", "fill"]}
                    onValue=${(v) => patch({ image: { ...block.image, fit: v } })}
                  />
                `
              : null}
          `
        : null}

      ${block.type === "circle"
        ? null
        : html`<${RadiusEditor} value=${block.radiusPx} onValue=${(v) => patch({ radiusPx: v })} />`}
      <${BorderEditor}
        label="Bordure (4 côtés)"
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
      <${VisibleIfEditor}
        value=${block.visibleIf}
        schemaInfo=${schemaInfo}
        onValue=${(v) => patch({ visibleIf: v })}
      />
    </div>
  `;
}
