const $ = (id) => document.getElementById(id);
const els = {
  template: $("template"),
  variant: $("variant"),
  manifest: $("manifest"),
  errors: $("errors"),
  pdf: $("pdf"),
  save: $("save"),
  status: $("status"),
};

let lastObjectUrl = null;
let timer = null;

function setStatus(text) {
  els.status.textContent = text;
}

function showErrors(errors) {
  els.errors.innerHTML = "";
  for (const error of errors) {
    const li = document.createElement("li");
    li.textContent = error;
    els.errors.append(li);
  }
  els.errors.hidden = errors.length === 0;
}

// Un manifeste invalide n'efface pas l'apercu : sans cette regle, le rendu
// disparaitrait des la premiere accolade ouverte pendant la frappe.
async function render() {
  const name = els.template.value;
  if (!name) return;
  setStatus("Rendu…");
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, manifest: els.manifest.value, context: presets[els.variant.value] }),
  });
  if (res.status === 422) {
    showErrors((await res.json()).errors);
    setStatus("Manifeste invalide");
    return;
  }
  if (!res.ok) {
    showErrors([`Erreur ${res.status}`]);
    setStatus("");
    return;
  }
  showErrors([]);
  const blob = await res.blob();
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(blob);
  els.pdf.data = lastObjectUrl;
  setStatus("À jour");
}

function scheduleRender() {
  clearTimeout(timer);
  timer = setTimeout(render, 600);
}

async function loadTemplate(name) {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`);
  if (!res.ok) {
    showErrors([`Template introuvable : ${name}`]);
    return;
  }
  els.manifest.value = (await res.json()).manifest;
  await render();
}

async function save() {
  const name = els.template.value;
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: els.manifest.value }),
  });
  setStatus(res.ok ? "Enregistré" : `Échec de l'enregistrement (${res.status})`);
}

// Contextes des presets, indexes par identifiant : l'ancien selecteur de variante
// envoie desormais un contexte complet, comme le fera le formulaire de la spec 18.
const presets = {};

async function boot() {
  const [templates, schema] = await Promise.all([
    fetch("/api/templates").then((r) => r.json()),
    fetch("/api/schema-info").then((r) => r.json()),
  ]);

  for (const preset of schema.presets) {
    presets[preset.id] = preset.input;
    els.variant.append(new Option(preset.label, preset.id));
  }
  for (const template of templates.templates) {
    els.template.append(new Option(template.name, template.name));
  }

  els.manifest.addEventListener("input", scheduleRender);
  els.variant.addEventListener("change", render);
  els.template.addEventListener("change", () => loadTemplate(els.template.value));
  els.save.addEventListener("click", save);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      save();
    }
  });

  if (templates.templates.length > 0) {
    await loadTemplate(templates.templates[0].name);
  } else {
    setStatus("Aucun template dans l'atelier — lancez make new-badge-template NAME=…");
  }
}

boot();
