"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/FileBox";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { PRODUCTS_API, sendJson, uploadProductImage, VALIDATION_MESSAGE } from "./catalog-api";

type Img = { storageKey: string; alt: string };
const MAX_IMAGES = 10;

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function ProductGalleryEditor({
  productId,
  images: initial,
  disabled,
  onSaved,
}: {
  productId: string;
  images: Img[];
  disabled: boolean;
  onSaved: () => void;
}) {
  const [images, setImages] = useState<Img[]>(initial);

  const upload = useAsyncAction(
    async (files: FileList) => {
      const room = MAX_IMAGES - images.length;
      const added: Img[] = [];
      for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
        added.push({ storageKey: await uploadProductImage(file), alt: "" });
      }
      return added;
    },
    { onSuccess: (added) => setImages((list) => [...list, ...added].slice(0, MAX_IMAGES)) },
  );

  const save = useAsyncAction(
    () => sendJson(`${PRODUCTS_API}/${productId}/images`, "PUT", { images }),
    { success: "Galerie enregistrée.", error: VALIDATION_MESSAGE, onSuccess: onSaved },
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{"La première image est l'image principale."}</p>
      {images.length === 0 ? <p className="text-sm text-slate-400">Aucune image.</p> : null}
      <ul className="space-y-3">
        {images.map((img, i) => (
          <li key={img.storageKey} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${img.storageKey}`} alt={img.alt} className="h-20 w-20 flex-none rounded-lg border border-slate-200 object-cover" />
            <div className="min-w-0 flex-1 basis-48">
              <Input
                label="Texte alternatif"
                value={img.alt}
                maxLength={200}
                disabled={disabled}
                onChange={(e) =>
                  setImages((list) => list.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))
                }
              />
              {disabled ? null : (
                <div className="-mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={i === 0} onClick={() => setImages((l) => move(l, i, -1))}>
                    Monter
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={i === images.length - 1}
                    onClick={() => setImages((l) => move(l, i, 1))}
                  >
                    Descendre
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setImages((l) => l.filter((_, k) => k !== i))}>
                    Retirer
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {disabled || images.length >= MAX_IMAGES ? null : (
        <Dropzone
          accept="image/jpeg,image/png,image/webp"
          title={upload.pending ? "Téléversement en cours…" : "Ajouter des images"}
          subtitle={`JPEG, PNG ou WebP, 5 Mo max · ${images.length}/${MAX_IMAGES}`}
          onFiles={(files) => void upload.run(files)}
        />
      )}
      {disabled ? null : (
        <Button type="button" disabled={save.pending || upload.pending} onClick={() => void save.run()}>
          Enregistrer la galerie
        </Button>
      )}
    </div>
  );
}
