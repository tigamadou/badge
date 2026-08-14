import { html, render, useCallback, useEffect, useState } from "/vendor/preact-htm.mjs";
import * as api from "/ui/api.js";
import { Preview } from "/ui/preview.js";
import { ContextForm } from "/ui/context-form.js";

const TABS = [
  ["context", "Contexte"],
  ["blocks", "Blocs"],
  ["json", "JSON"],
];

function App() {
  const [templates, setTemplates] = useState([]);
  const [current, setCurrent] = useState("");
  const [manifestText, setManifestText] = useState("");
  // `null` = contexte par defaut du serveur ; l'onglet Contexte le remplacera.
  const [context, setContext] = useState(null);
  const [tab, setTab] = useState("json");
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [schemaInfo, setSchemaInfo] = useState(null);

  const selectTemplate = useCallback(async (name) => {
    if (!name) return;
    const read = await api.getTemplate(name);
    setCurrent(name);
    setManifestText(read.manifest);
    setErrors([]);
  }, []);

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
      <button type="button" onClick=${save}>Enregistrer</button>
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
            : html`<p class="placeholder">
                Onglet « ${TABS.find(([id]) => id === tab)[1]} » à venir.
              </p>`}
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
