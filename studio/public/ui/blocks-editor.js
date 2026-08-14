import { html, useState } from "/vendor/preact-htm.mjs";
import { BlockForm } from "/ui/block-form.js";

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
  image: { type: "image", page: 1, x: 20, y: 20, w: 100, h: 100, source: "participant.photoDataUrl" },
  qr: { type: "qr", page: 1, x: 20, y: 20, w: 60, h: 60 },
  rect: { type: "rect", page: 1, x: 20, y: 20, w: 100, h: 40, fill: "#e2e8f0" },
};

const TYPE_LABELS = { text: "Texte", image: "Image", qr: "QR", rect: "Aplat" };

function summarize(block) {
  if (block.type === "text") return block.text?.slice(0, 40) ?? "";
  if (block.type === "image") return block.source ?? block.asset ?? "";
  if (block.type === "rect") return block.fill ?? "";
  return "";
}

export function BlocksEditor({ manifest, schemaInfo, assets, blockErrors, onChange }) {
  const [open, setOpen] = useState(-1);
  const blocks = manifest.blocks ?? [];
  const fonts = manifest.fonts ?? [];
  const pageCount = manifest.page?.count ?? 1;

  const replace = (next) => onChange({ ...manifest, blocks: next });

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    replace(next);
    setOpen(target);
  };

  return html`
    <div class="blocks">
      <div class="row wrap">
        ${Object.entries(TYPE_LABELS).map(
          ([type, label]) => html`
            <button
              type="button"
              onClick=${() => {
                replace([...blocks, structuredClone(BLOCK_DEFAULTS[type])]);
                setOpen(blocks.length);
              }}
            >
              + ${label}
            </button>
          `,
        )}
      </div>

      <ol class="block-list">
        ${blocks.map(
          (block, index) => html`
            <li class=${blockErrors?.[index] ? "faulty" : ""}>
              <div class="row block-head">
                <button type="button" class="grow" onClick=${() => setOpen(open === index ? -1 : index)}>
                  ${index + 1}. ${TYPE_LABELS[block.type]} · ${summarize(block)}
                  <span class="dim">${block.x},${block.y} ${block.w}×${block.h}</span>
                </button>
                <button type="button" title="Monter" onClick=${() => move(index, -1)}>↑</button>
                <button type="button" title="Descendre" onClick=${() => move(index, 1)}>↓</button>
                <button
                  type="button"
                  title="Dupliquer"
                  onClick=${() => replace([...blocks.slice(0, index + 1), structuredClone(block), ...blocks.slice(index + 1)])}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  onClick=${() => {
                    replace(blocks.filter((_, j) => j !== index));
                    setOpen(-1);
                  }}
                >
                  ✕
                </button>
              </div>
              ${blockErrors?.[index]
                ? html`<p class="warning">${blockErrors[index].join(" ")}</p>`
                : null}
              ${open === index
                ? html`<${BlockForm}
                    block=${block}
                    schemaInfo=${schemaInfo}
                    pageCount=${pageCount}
                    assets=${assets}
                    fonts=${fonts}
                    onChange=${(next) => replace(blocks.map((b, j) => (j === index ? next : b)))}
                  />`
                : null}
            </li>
          `,
        )}
      </ol>
    </div>
  `;
}
