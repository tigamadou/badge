"use client";
import { useCallback, useEffect, useState, type ComponentType, type ReactElement } from "react";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";
import {
  checkAgainst,
  computeCropOutput,
  type ImageRequirement,
} from "@/lib/badge-templates/image-frames";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

// Charge a l'ouverture seulement : la librairie ne pese pas sur les pages qui n'ouvrent jamais le cadrage.
type CropperComponentProps = {
  image: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (area: Area, pixels: Area) => void;
};
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false }) as unknown as ComponentType<CropperComponentProps>;

export type CropSource = Blob | string;

export function outputMimeFor(file: Blob): "image/png" | "image/jpeg" {
  return file.type === "image/jpeg" ? "image/jpeg" : "image/png";
}

export function isConforming(size: { width: number; height: number }, requirement: ImageRequirement): boolean {
  return checkAgainst(size, requirement).ok;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = url;
  });
}

async function withUrl<T>(source: CropSource, run: (url: string) => Promise<T>): Promise<T> {
  if (typeof source === "string") return run(source);
  const url = URL.createObjectURL(source);
  try {
    return await run(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image illisible."));
    reader.readAsDataURL(blob);
  });
}

export function readImageSize(source: CropSource): Promise<{ width: number; height: number }> {
  return withUrl(source, async (url) => {
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
}

// Recadre `source` sur `area` (pixels de l'image d'origine) vers la taille de sortie du cadre.
export function cropToBlob(
  source: CropSource,
  area: { x: number; y: number; width: number; height: number },
  requirement: ImageRequirement,
  mime: "image/png" | "image/jpeg",
): Promise<Blob> {
  return withUrl(source, async (url) => {
    const img = await loadImage(url);
    const out = computeCropOutput(area, requirement);
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Recadrage indisponible sur ce navigateur.");
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Recadrage impossible."))), mime, 0.92);
    });
  });
}

type CropperProps = {
  title: string;
  source: CropSource | null;
  requirement: ImageRequirement;
  outputMime: "image/png" | "image/jpeg";
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
};

// Le dialogue ne monte son corps qu'ouvert : zoom, position et zone repartent a zero a chaque ouverture.
export function ImageCropper({ open, ...props }: CropperProps & { open: boolean }) {
  return (
    <Dialog open={open} title={props.title} onClose={props.onCancel}>
      <CropperBody {...props} />
    </Dialog>
  );
}

function CropperBody({ source, requirement, outputMime, onConfirm, onCancel }: CropperProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fichier local : lu en data URL (pas d'objet URL a revoquer, pas de piege du double montage).
  useEffect(() => {
    if (!source || typeof source === "string") return;
    let alive = true;
    blobToDataUrl(source).then(
      (url) => alive && setDataUrl(url),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [source]);
  const imageUrl = typeof source === "string" ? source : dataUrl;

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  // 1 px de tolerance : la zone rendue par la librairie est arrondie.
  const tooSmall = area !== null && (area.width + 1 < requirement.minWidth || area.height + 1 < requirement.minHeight);
  const example = `${requirement.exampleWidth} × ${requirement.exampleHeight} px`;
  const ready = area !== null && !tooSmall;

  function confirm() {
    if (!source || !area) return;
    setBusy(true);
    setFailed(false);
    cropToBlob(source, area, requirement, outputMime).then(
      (blob) => {
        setBusy(false);
        onConfirm(blob);
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
    );
  }

  return (
    <>
      <p className="mb-3 text-[13px] text-slate-600">
        Format attendu : {requirement.ratioLabel}, par ex. {example}
      </p>
      <div className="relative h-64 w-full overflow-hidden rounded-lg bg-slate-900 sm:h-96">
        {imageUrl ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={requirement.ratio.width / requirement.ratio.height}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
          />
        ) : null}
      </div>
      <label className="mt-4 flex items-center gap-3 text-[13px] text-slate-600">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Zoom"
        />
      </label>
      {tooSmall ? (
        <p role="alert" className="mt-3 text-[13px] text-amber-700">
          Image trop petite pour ce cadre : envoyez-en une autre (minimum {requirement.minWidth} × {requirement.minHeight} px).
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="mt-3 text-[13px] text-rose-700">
          Le recadrage a échoué : réessayez ou choisissez une autre image.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" loading={busy} disabled={!ready} onClick={confirm}>
          Valider le cadrage
        </Button>
      </div>
    </>
  );
}

// Parcours « choisir une image » : envoi direct si elle respecte deja le cadre, cadrage sinon.
// WebP passe toujours par le cadrage (le moteur de rendu ne le lit pas ; la sortie est un PNG).
// Une image illisible part telle quelle : le serveur explique le refus.
export function useCropFlow(
  requirement: ImageRequirement,
  title: string,
  upload: (file: File) => Promise<void>,
): { choose: (file: File | null | undefined) => Promise<void>; recrop: (url: string) => void; cropper: ReactElement } {
  const [source, setSource] = useState<CropSource | null>(null);

  async function choose(file: File | null | undefined) {
    if (!file) return;
    const size = await readImageSize(file).catch(() => null);
    if (!size || (file.type !== "image/webp" && isConforming(size, requirement))) {
      await upload(file);
      return;
    }
    setSource(file);
  }

  async function confirm(blob: Blob) {
    setSource(null);
    await upload(new File([blob], `photo.${blob.type === "image/jpeg" ? "jpg" : "png"}`, { type: blob.type }));
  }

  const outputMime =
    typeof source === "string" ? (/\.jpe?g$/i.test(source) ? "image/jpeg" : "image/png") : source ? outputMimeFor(source) : "image/png";

  const cropper = (
    <ImageCropper
      open={source !== null}
      title={title}
      source={source}
      requirement={requirement}
      outputMime={outputMime}
      onConfirm={confirm}
      onCancel={() => setSource(null)}
    />
  );
  return { choose, recrop: setSource, cropper };
}
