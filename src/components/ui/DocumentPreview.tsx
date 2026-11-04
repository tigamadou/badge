"use client";

import { useState } from "react";
import { FileBox } from "./FileBox";
import { Icon } from "./Icon";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// Le mime n'est pas persiste : le type est deduit de l'extension de la cle de
// stockage. L'upload contraint deja les types (JPEG/PNG/WebP/PDF).
function isImageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function DocumentPreview({
  storageKey,
  label,
  readable = true,
  defaultOpen = false,
}: {
  storageKey: string | null;
  label: string;
  readable?: boolean;
  // Ouvre l'apercu des le montage (lien direct depuis une liste).
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!storageKey) {
    return <FileBox icon="file" title={label} subtitle="Non fournie" />;
  }

  if (!readable) {
    return (
      <FileBox
        icon="file"
        title={label}
        subtitle="Vérifiée par la plateforme — non consultable ici"
      />
    );
  }

  const url = `/api/files/${storageKey}`;
  const image = isImageKey(storageKey);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <FileBox
          icon={image ? "user" : "file"}
          title={label}
          subtitle="Cliquer pour agrandir"
          thumbUrl={image ? url : undefined}
          action={<Icon name="external-link" size={16} />}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-xl bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{label}</span>
              <div className="flex items-center gap-3">
                <a href={url} target="_blank" rel="noreferrer" className="text-sm text-navy hover:underline">
                  Ouvrir dans un onglet
                </a>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label} className="max-h-[70vh] w-full object-contain" />
            ) : (
              <iframe src={url} title={label} className="h-[70vh] w-full rounded-lg border border-slate-200" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
