import { html, useState } from "/vendor/preact-htm.mjs";
import * as api from "/ui/api.js";

// Metadonnees du paquet, polices declarees et depot de ressources. Le dossier de
// l'atelier est la source unique : ce qui est ici part tel quel dans le zip.

function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`;
}

function only(assets, prefix) {
  return assets.filter((path) => path.startsWith(prefix));
}

export function MetaPanel({ name, manifest, assets, onChange, onAssetsChanged }) {
  const [uploadError, setUploadError] = useState("");
  const images = only(assets, "assets/");
  const fontFiles = only(assets, "fonts/");
  const fonts = manifest.fonts ?? [];

  const patch = (changes) => onChange({ ...manifest, ...changes });

  const upload = async (dir, file) => {
    setUploadError("");
    const res = await api.uploadAsset(name, dir, file);
    if (!res.ok) {
      setUploadError(res.error);
      return;
    }
    onAssetsChanged();
  };

  const previewMissing = manifest.preview && !assets.includes(manifest.preview);

  return html`
    <div class="form">
      <section>
        <h2>Identité</h2>
        <${Field} label="Famille">
          <input type="text" value=${manifest.family ?? ""} onInput=${(e) => patch({ family: e.target.value })} />
        <//>
        <${Field} label="Libellé">
          <input type="text" value=${manifest.label ?? ""} onInput=${(e) => patch({ label: e.target.value })} />
        <//>
        <${Field} label="Description">
          <input
            type="text"
            value=${manifest.description ?? ""}
            onInput=${(e) => patch({ description: e.target.value })}
          />
        <//>
      </section>

      <section>
        <h2>Page</h2>
        <${Field} label="Largeur (px)">
          <input
            type="number"
            step="0.01"
            value=${manifest.page?.widthPx ?? ""}
            onInput=${(e) => patch({ page: { ...manifest.page, widthPx: Number(e.target.value) } })}
          />
        <//>
        <${Field} label="Hauteur (px)">
          <input
            type="number"
            step="0.01"
            value=${manifest.page?.heightPx ?? ""}
            onInput=${(e) => patch({ page: { ...manifest.page, heightPx: Number(e.target.value) } })}
          />
        <//>
        <${Field} label="Pages">
          <input
            type="number"
            min="1"
            max="4"
            value=${manifest.page?.count ?? 1}
            onInput=${(e) => patch({ page: { ...manifest.page, count: Number(e.target.value) } })}
          />
        <//>
      </section>

      <section>
        <h2>Aperçu du catalogue</h2>
        <${Field} label="Image">
          <select
            value=${manifest.preview ?? ""}
            onChange=${(e) => patch({ preview: e.target.value || undefined })}
          >
            <option value="">— aucune —</option>
            ${images.map((path) => html`<option value=${path}>${path}</option>`)}
          </select>
        <//>
        ${previewMissing
          ? html`<p class="warning">⚠ « ${manifest.preview} » n'est plus dans le paquet.</p>`
          : null}
      </section>

      <section>
        <h2>Polices</h2>
        ${fonts.map(
          (font, index) => html`
            <div class="row">
              <input
                type="text"
                placeholder="alias"
                value=${font.alias}
                onInput=${(e) =>
                  patch({
                    fonts: fonts.map((f, j) => (j === index ? { ...f, alias: e.target.value } : f)),
                  })}
              />
              <select
                value=${font.file}
                onChange=${(e) =>
                  patch({
                    fonts: fonts.map((f, j) => (j === index ? { ...f, file: e.target.value } : f)),
                  })}
              >
                <option value="">— fichier —</option>
                ${fontFiles.map((path) => html`<option value=${path}>${path}</option>`)}
              </select>
              <select
                value=${font.weight ?? 400}
                onChange=${(e) =>
                  patch({
                    fonts: fonts.map((f, j) =>
                      j === index ? { ...f, weight: Number(e.target.value) } : f,
                    ),
                  })}
              >
                ${[400, 500, 600, 700].map((w) => html`<option value=${w}>${w}</option>`)}
              </select>
              <label class="toggle">
                <input
                  type="checkbox"
                  checked=${font.style === "italic"}
                  onChange=${(e) =>
                    patch({
                      fonts: fonts.map((f, j) =>
                        j === index ? { ...f, style: e.target.checked ? "italic" : undefined } : f,
                      ),
                    })}
                />
                <span>italique</span>
              </label>
              <button
                type="button"
                onClick=${() => patch({ fonts: fonts.filter((_, j) => j !== index) })}
              >
                ✕
              </button>
              ${font.file && !assets.includes(font.file)
                ? html`<span class="warning">⚠ fichier absent</span>`
                : null}
            </div>
          `,
        )}
        <div class="row">
          <button
            type="button"
            onClick=${() => patch({ fonts: [...fonts, { alias: "titre", file: fontFiles[0] ?? "" }] })}
          >
            + police
          </button>
        </div>
      </section>

      <section>
        <h2>Ressources du paquet</h2>
        <div class="row wrap">
          <label class="upload">
            Ajouter une image
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange=${(e) => e.target.files?.[0] && upload("assets", e.target.files[0])}
            />
          </label>
          <label class="upload">
            Ajouter une police
            <input
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf"
              onChange=${(e) => e.target.files?.[0] && upload("fonts", e.target.files[0])}
            />
          </label>
        </div>
        ${uploadError ? html`<p class="warning">${uploadError}</p>` : null}
        <ul class="assets">
          ${assets.map((path) => html`<li>${path}</li>`)}
          ${assets.length === 0 ? html`<li class="dim">Aucune ressource.</li>` : null}
        </ul>
      </section>
    </div>
  `;
}
