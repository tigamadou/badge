// Client HTTP du studio. Chaque fonction rend soit la donnee attendue, soit un
// objet { ok: false, errors } : l'interface n'a jamais a lire un status brut.

async function json(url, options) {
  const res = await fetch(url, options);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}

function post(url, payload) {
  return json(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listTemplates() {
  const { body } = await json("/api/templates");
  return body?.templates ?? [];
}

export async function getSchemaInfo() {
  const { body } = await json("/api/schema-info");
  return body;
}

export async function getTemplate(name) {
  const { status, body } = await json(`/api/templates/${encodeURIComponent(name)}`);
  if (status !== 200) return { manifest: "", assets: [] };
  return body;
}

export async function putManifest(name, manifest) {
  const { status } = await json(`/api/templates/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  return status === 200;
}

export async function createTemplate(name) {
  const { status, body } = await post("/api/templates", { name });
  if (status === 201) return { ok: true };
  return { ok: false, error: body?.error ?? `Échec (${status})` };
}

// Le rendu renvoie un PDF binaire : on ne passe donc pas par `json()`.
export async function renderPdf(name, manifest, context) {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, manifest, context: context ?? undefined }),
  });
  if (res.status === 422) return { ok: false, errors: (await res.json()).errors };
  if (!res.ok) return { ok: false, errors: [`Échec du rendu (${res.status}).`] };
  return { ok: true, blob: await res.blob() };
}

export async function packTemplate(name, manifest) {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}/pack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  if (res.status === 422) return { ok: false, errors: (await res.json()).errors };
  if (!res.ok) return { ok: false, errors: [`Échec de l'empaquetage (${res.status}).`] };
  return { ok: true, blob: await res.blob() };
}

// Les fichiers voyagent en base64 : le serveur du studio ne lit que du JSON.
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export async function uploadAsset(name, dir, file) {
  const dataBase64 = await toBase64(file);
  const { status, body } = await post(`/api/templates/${encodeURIComponent(name)}/assets`, {
    dir,
    filename: file.name,
    dataBase64,
  });
  if (status === 200) return { ok: true, path: body.path };
  return { ok: false, error: body?.error ?? `Échec du dépôt (${status})` };
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
