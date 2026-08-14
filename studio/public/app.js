import { html, render, useCallback, useEffect, useMemo, useState } from "/vendor/preact-htm.mjs";
import * as api from "/ui/api.js";
import { Preview } from "/ui/preview.js";
import { ContextForm } from "/ui/context-form.js";
import { BlocksEditor } from "/ui/blocks-editor.js";
import { MetaPanel } from "/ui/meta-panel.js";

const TABS = [
  ["context", "Contexte"],
  ["blocks", "Blocs"],
  ["package", "Paquet"],
  ["json", "JSON"],
];

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Les erreurs de validation nomment leur bloc (« bloc 3 : ... ») : on les range
// par index pour les afficher sur l'entree fautive de la liste.
function groupErrorsByBlock(errors) {
  const grouped = {};
  for (const error of errors) {
    const match = /^bloc (\d+)/.exec(error);
    if (!match) continue;
    const index = Number(match[1]) - 1;
    (grouped[index] ??= []).push(error);
  }
  return grouped;
}

function App() {
  const [templates, setTemplates] = useState([]);
  const [current, setCurrent] = useState("");
  const [assets, setAssets] = useState([]);
  const [manifestText, setManifestText] = useState("");
  // `null` = contexte par defaut du serveur ; l'onglet Contexte le remplace.
  const [context, setContext] = useState(null);
  const [tab, setTab] = useState("blocks");
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [schemaInfo, setSchemaInfo] = useState(null);

  // Le manifeste parse est DERIVE du texte : une seule source de verite, et un
  // JSON invalide n'ecrase jamais l'etat (il rend juste l'onglet Blocs indisponible).
  const manifest = useMemo(() => {
    try {
      const parsed = JSON.parse(manifestText);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }, [manifestText]);

  const selectTemplate = useCallback(async (name) => {
    if (!name) return;
    const read = await api.getTemplate(name);
    setCurrent(name);
    setManifestText(read.manifest);
    setAssets(read.assets ?? []);
    setErrors([]);
  }, []);

  // Rechargement des seules ressources : appele apres un depot de fichier, pour
  // que les listes deroulantes (apercu, asset, police) voient le nouveau fichier.
  const refreshAssets = useCallback(async () => {
    const read = await api.getTemplate(current);
    setAssets(read.assets ?? []);
  }, [current]);

  const createTemplate = useCallback(async () => {
    const name = prompt("Nom du template (minuscules-et-tirets) :");
    if (!name) return;
    if (!NAME_PATTERN.test(name)) {
      setStatus("Nom invalide (minuscules-et-tirets)");
      return;
    }
    const res = await api.createTemplate(name);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    setTemplates(await api.listTemplates());
    selectTemplate(name);
    setStatus("Template créé");
    setTimeout(() => setStatus(""), 2000);
  }, [selectTemplate]);

  useEffect(() => {
    api.listTemplates().then((list) => {
      setTemplates(list);
      if (list.length > 0) selectTemplate(list[0].name);
    });
    api.getSchemaInfo().then(setSchemaInfo);
  }, [selectTemplate]);

  const save = useCallback(async () => {
    const ok = await api.putManifest(current, manifestText);
    setStatus(ok ? "Enregistré" : "Échec de l'enregistrement");
    setTimeout(() => setStatus(""), 2000);
  }, [current, manifestText]);

  const updateManifest = useCallback(
    (next) => setManifestText(`${JSON.stringify(next, null, 2)}\n`),
    [],
  );

  // Le paquet est produit a partir du manifeste ENREGISTRE : packFromStudio ecrit
  // d'abord le texte envoye, puis empaquette le dossier tel qu'il est sur disque.
  const pack = useCallback(async () => {
    setStatus("Empaquetage…");
    const res = await api.packTemplate(current, manifestText);
    if (!res.ok) {
      setErrors(res.errors);
      setStatus("Empaquetage refusé");
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${current}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Paquet téléchargé");
    setTimeout(() => setStatus(""), 2000);
  }, [current, manifestText]);

  const blockErrors = useMemo(() => groupErrorsByBlock(errors), [errors]);

  return html`
    <header>
      <h1>Studio de templates</h1>
      <select
        aria-label="Template"
        value=${current}
        onChange=${(e) => selectTemplate(e.target.value)}
      >
        ${templates.map((t) => html`<option value=${t.name}>${t.name}</option>`)}
      </select>
      <button type="button" onClick=${createTemplate}>Nouveau template</button>
      <button type="button" onClick=${save}>Enregistrer</button>
      <button type="button" onClick=${pack}>Générer le paquet</button>
      <span role="status">${status}</span>
    </header>
    <main>
      <section class="editor">
        <nav class="tabs">
          ${TABS.map(
            ([id, label]) => html`
              <button
                type="button"
                class=${tab === id ? "active" : ""}
                onClick=${() => setTab(id)}
              >
                ${label}
              </button>
            `,
          )}
        </nav>

        ${tab === "json"
          ? html`<textarea
              spellcheck="false"
              aria-label="Manifeste"
              value=${manifestText}
              onInput=${(e) => setManifestText(e.target.value)}
            ></textarea>`
          : tab === "context"
            ? html`<${ContextForm}
                context=${context}
                schemaInfo=${schemaInfo}
                onChange=${setContext}
              />`
            : tab === "package"
              ? manifest
                ? html`<${MetaPanel}
                    name=${current}
                    manifest=${manifest}
                    assets=${assets}
                    onChange=${updateManifest}
                    onAssetsChanged=${refreshAssets}
                  />`
                : html`<p class="placeholder">Corrigez le JSON pour éditer le paquet.</p>`
              : manifest
              ? html`<${BlocksEditor}
                  manifest=${manifest}
                  schemaInfo=${schemaInfo}
                  assets=${assets}
                  blockErrors=${blockErrors}
                  onChange=${updateManifest}
                />`
              : html`<p class="placeholder">Corrigez le JSON pour éditer les blocs.</p>`}

        <ul class="errors" hidden=${errors.length === 0}>
          ${errors.map((e) => html`<li>${e}</li>`)}
        </ul>
      </section>
      <${Preview}
        name=${current}
        manifestText=${manifestText}
        context=${context}
        onErrors=${setErrors}
        onStatus=${setStatus}
      />
    </main>
  `;
}

render(html`<${App} />`, document.getElementById("app"));
