"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

type Variable = { name: string; kind: string; label: string };
type Inspection = {
  file: File;
  variables: Variable[];
  bindings: Record<string, string | null | undefined>;
  sources: Record<string, string>;
};

// Libelles francais des types de variable ; un type inconnu s'affiche tel quel
// plutot que de disparaitre.
const KIND_LABELS: Record<string, string> = {
  text: "texte",
  image: "image",
  boolean: "booléen",
  date: "date",
  color: "couleur",
  list: "liste",
};

// Object.hasOwn : une variable nommee `constructor` ou `toString` ne doit pas
// lire la valeur heritee du prototype, sinon elle paraitrait deja decidee.
function bindingOf(bindings: Inspection["bindings"], name: string): string | null | undefined {
  return Object.hasOwn(bindings, name) ? bindings[name] : undefined;
}

export function BadgeTemplateInstaller() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  // Distinct de `pending` (qui ne couvre que router.refresh) : couvre la requete
  // POST elle-meme, pour desactiver le bouton et eviter une double soumission.
  const [installing, setInstalling] = useState(false);

  async function inspect(file: File) {
    setErrors([]);
    setSuccess(null);
    // Oublier l'inspection precedente AVANT la requete : si celle-ci echoue, le
    // bouton ne doit pas rester arme sur l'ancien fichier.
    setInspection(null);
    const form = new FormData();
    form.set("archive", file);
    const res = await fetch("/api/platform/badge-templates/inspect", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(data.errors ?? ["La lecture du paquet a échoué."]);
      return;
    }
    // Une variable sans suggestion reste NON DECIDEE (undefined) : le bouton
    // d'installation attend un choix explicite, fût-il « laisser vide ».
    setInspection({ file, variables: data.variables, bindings: data.suggested, sources: data.sources });
  }

  async function install() {
    if (!inspection) return;
    setErrors([]);
    setInstalling(true);
    try {
      const form = new FormData();
      form.set("archive", inspection.file);
      form.set("bindings", JSON.stringify(inspection.bindings));

      const res = await fetch("/api/platform/badge-templates", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? ["L'installation a échoué."]);
        return;
      }
      setSuccess(`Template « ${data.family} » installé en version ${data.version}.`);
      setInspection(null);
      if (inputRef.current) inputRef.current.value = "";
      startTransition(() => router.refresh());
    } finally {
      setInstalling(false);
    }
  }

  const decided = (inspection?.variables ?? []).every(
    (variable) => bindingOf(inspection!.bindings, variable.name) !== undefined,
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Installer un template</h2>
      <p className="mt-1 text-xs text-slate-600">
        Archive ZIP contenant <code>manifest.json</code> à la racine, et si besoin les dossiers{" "}
        <code>assets/</code> (JPEG, PNG) et <code>fonts/</code> (TTF, OTF).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void inspect(file);
          }}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {pending && <span className="text-xs text-slate-500">Installation…</span>}
      </div>

      {inspection && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Liaisons des variables</h3>
          <p className="mt-1 text-xs text-slate-600">
            Chaque variable du template doit recevoir une source, ou être laissée vide
            explicitement.
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-3 text-left text-xs font-semibold text-slate-700">
                  Variable
                </th>
                <th scope="col" className="py-1 pr-3 text-left text-xs font-semibold text-slate-700">
                  Libellé
                </th>
                <th scope="col" className="py-1 pr-3 text-left text-xs font-semibold text-slate-700">
                  Type
                </th>
                <th scope="col" className="py-1 text-left text-xs font-semibold text-slate-700">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {inspection.variables.map((variable) => (
                <tr key={variable.name}>
                  <td className="py-1 pr-3 font-mono text-xs">{variable.name}</td>
                  <td className="py-1 pr-3 text-xs">{variable.label}</td>
                  <td className="py-1 pr-3 text-xs text-slate-500">
                    {KIND_LABELS[variable.kind] ?? variable.kind}
                  </td>
                  <td className="py-1">
                    <select
                      aria-label={`Source de la variable ${variable.name}`}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={
                        bindingOf(inspection.bindings, variable.name) === undefined
                          ? ""
                          : (bindingOf(inspection.bindings, variable.name) ?? "__empty__")
                      }
                      onChange={(e) =>
                        setInspection({
                          ...inspection,
                          bindings: {
                            ...inspection.bindings,
                            [variable.name]:
                              e.target.value === ""
                                ? undefined
                                : e.target.value === "__empty__"
                                  ? null
                                  : e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">— choisir —</option>
                      <option value="__empty__">— laisser vide —</option>
                      {Object.entries(inspection.sources)
                        .filter(([, kind]) => kind === variable.kind)
                        .map(([source]) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            disabled={!decided || pending || installing}
            onClick={() => void install()}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {installing ? "Installation…" : "Installer"}
          </button>
        </div>
      )}

      {success && (
        <div className="mt-3" data-testid="install-success">
          <Alert tone="success">
            <Icon name="check" size={16} /> {success}
          </Alert>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-3" data-testid="install-errors">
          <Alert tone="err">
            <div>
              <p className="font-semibold">Le paquet a été refusé :</p>
              <ul className="mt-1 list-inside list-disc text-[13px]">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </Alert>
        </div>
      )}
    </div>
  );
}
