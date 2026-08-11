"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export function BadgeTemplateInstaller() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function install(file: File) {
    setErrors([]);
    setSuccess(null);

    const form = new FormData();
    form.set("archive", file);

    const res = await fetch("/api/platform/badge-templates", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // La route renvoie la liste complete des erreurs : l'installateur doit pouvoir
      // corriger son paquet en une passe.
      setErrors(data.errors ?? ["L'installation a échoué."]);
      return;
    }

    setSuccess(`Template « ${data.family} » installé en version ${data.version}.`);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

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
            if (file) void install(file);
          }}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {pending && <span className="text-xs text-slate-500">Installation…</span>}
      </div>

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
