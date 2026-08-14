import { html, useState } from "/vendor/preact-htm.mjs";
import * as tree from "/ui/blocks-tree.js";

// Blocs prets a poser : des valeurs volontairement modestes, visibles sur une
// carte CR80 (323,53 x 204,09 px a 96 dpi) sans deborder.
export const BLOCK_DEFAULTS = {
  text: {
    type: "text",
    page: 1,
    x: 20,
    y: 20,
    w: 200,
    h: 30,
    text: "Texte",
    style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
  },
  rect: { type: "rect", page: 1, x: 20, y: 20, w: 100, h: 40, fill: "#e2e8f0" },
  square: { type: "square", page: 1, x: 20, y: 20, w: 80, h: 80, fill: "#e2e8f0" },
  circle: { type: "circle", page: 1, x: 20, y: 20, w: 80, h: 80, fill: "#e2e8f0" },
  qr: { type: "qr", page: 1, x: 20, y: 20, w: 60, h: 60 },
};

export const TYPE_LABELS = {
  text: "Texte",
  qr: "QR Code",
  rect: "Rectangle",
  square: "Carré",
  circle: "Cercle",
  group: "Groupe",
};

const GLYPHS = { text: "T", qr: "▩", rect: "▭", square: "◻", circle: "◯", group: "▣" };

function summarize(block) {
  if (block.type === "text") return block.text?.slice(0, 30) ?? "";
  if (block.type === "group") return `${block.blocks?.length ?? 0} blocs`;
  if (block.type === "rect" || block.type === "square" || block.type === "circle") {
    return block.image?.source ?? block.image?.asset ?? block.fill ?? "";
  }
  return "";
}

const key = (path) => JSON.stringify(path);
const parentOf = (path) => path.slice(0, -1);

export function BlocksEditor({ manifest, selection, blockErrors, onSelect, onChange, onError }) {
  const [checked, setChecked] = useState([]);
  const [collapsed, setCollapsed] = useState([]);
  const [renaming, setRenaming] = useState(null);

  const blocks = manifest.blocks ?? [];
  const replace = (next) => onChange({ ...manifest, blocks: next });

  const toggleChecked = (path) => {
    const id = key(path);
    setChecked(checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id]);
  };

  // Grouper n'a de sens qu'entre freres : on compare les chemins prives de leur
  // dernier segment.
  const checkedPaths = checked.map((c) => JSON.parse(c));
  const sameParent =
    checkedPaths.length >= 2 &&
    checkedPaths.every((p) => key(parentOf(p)) === key(parentOf(checkedPaths[0])));

  const group = () => {
    const parentPath = parentOf(checkedPaths[0]);
    const indices = checkedPaths.map((p) => p[p.length - 1]).sort((a, b) => a - b);
    const res = tree.groupSiblings(blocks, parentPath, indices);
    if (!res.ok) {
      onError?.([res.reason]);
      return;
    }
    replace(res.blocks);
    setChecked([]);
    onSelect([...parentPath, Math.min(...indices)]);
  };

  const ungroup = () => {
    const res = tree.ungroupAt(blocks, selection);
    if (!res.ok) {
      onError?.([res.reason]);
      return;
    }
    replace(res.blocks);
    onSelect(null);
  };

  const add = (type) => {
    const block = structuredClone(BLOCK_DEFAULTS[type]);
    const selected = selection ? tree.getAt(blocks, selection) : null;
    // Un groupe selectionne accueille le nouveau bloc : ses enfants n'ont pas de page.
    if (selected?.type === "group") {
      delete block.page;
      replace(
        tree.setAt(blocks, selection, { ...selected, blocks: [...(selected.blocks ?? []), block] }),
      );
      onSelect([...selection, (selected.blocks ?? []).length]);
      return;
    }
    replace([...blocks, block]);
    onSelect([blocks.length]);
  };

  function Row({ block, path, depth }) {
    const id = key(path);
    const isGroup = block.type === "group";
    const isCollapsed = collapsed.includes(id);
    const faulty = blockErrors?.[id];

    return html`
      <li class=${`${key(selection ?? []) === id ? "selected" : ""} ${faulty ? "faulty" : ""}`}>
        <div class="block-head" style=${`padding-left:${0.3 + depth * 0.75}rem`}>
          <input
            type="checkbox"
            title="Sélectionner pour grouper"
            checked=${checked.includes(id)}
            onChange=${() => toggleChecked(path)}
          />
          ${isGroup
            ? html`<button
                type="button"
                class="glyph"
                title=${isCollapsed ? "Déplier" : "Replier"}
                onClick=${() =>
                  setCollapsed(
                    isCollapsed ? collapsed.filter((c) => c !== id) : [...collapsed, id],
                  )}
              >
                ${isCollapsed ? "▸" : "▾"}
              </button>`
            : html`<span class="glyph">${GLYPHS[block.type]}</span>`}
          ${renaming === id
            ? html`<input
                type="text"
                value=${block.name ?? ""}
                onBlur=${(e) => {
                  replace(tree.setAt(blocks, path, { ...block, name: e.target.value || undefined }));
                  setRenaming(null);
                }}
                onKeyDown=${(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") setRenaming(null);
                }}
              />`
            : html`<button type="button" class="grow" onClick=${() => onSelect(path)}>
                ${block.name ?? TYPE_LABELS[block.type]}
                <span class="dim">${summarize(block)}</span>
              </button>`}
          <span class="row-actions">
            <button type="button" title="Renommer" onClick=${() => setRenaming(id)}>✎</button>
            <button
              type="button"
              title="Monter"
              onClick=${() => replace(tree.moveWithin(blocks, path, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              title="Descendre"
              onClick=${() => replace(tree.moveWithin(blocks, path, 1))}
            >
              ↓
            </button>
            <button
              type="button"
              title="Dupliquer"
              onClick=${() => replace(tree.insertAfter(blocks, path, structuredClone(block)))}
            >
              ⧉
            </button>
            <button
              type="button"
              title="Supprimer"
              onClick=${() => {
                replace(tree.removeAt(blocks, path));
                onSelect(null);
              }}
            >
              ✕
            </button>
          </span>
        </div>
        ${faulty ? html`<p class="warning">${faulty.join(" ")}</p>` : null}
        ${isGroup && !isCollapsed
          ? html`<ul class="block-list">
              ${(block.blocks ?? []).map(
                (child, index) =>
                  html`<${Row} block=${child} path=${[...path, index]} depth=${depth + 1} />`,
              )}
            </ul>`
          : null}
      </li>
    `;
  }

  return html`
    <div class="blocks">
      <div class="row wrap">
        ${Object.keys(BLOCK_DEFAULTS).map(
          (type) => html`
            <button type="button" title=${TYPE_LABELS[type]} onClick=${() => add(type)}>
              + ${GLYPHS[type]}
            </button>
          `,
        )}
      </div>

      <div class="row wrap">
        <button type="button" disabled=${!sameParent} onClick=${group}>Grouper</button>
        <button
          type="button"
          disabled=${!selection || tree.getAt(blocks, selection)?.type !== "group"}
          onClick=${ungroup}
        >
          Dégrouper
        </button>
      </div>

      <ul class="block-list">
        ${blocks.map((block, index) => html`<${Row} block=${block} path=${[index]} depth=${0} />`)}
      </ul>
    </div>
  `;
}
