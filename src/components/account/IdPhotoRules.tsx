import { ID_PHOTO_MIN, ID_PHOTO_REQUIREMENT } from "@/lib/badge-templates/image-frames";

export const ID_PHOTO_RULES = [
  "Visage de face et centré",
  "Fond blanc uni",
  "Tête nue (sauf motif religieux) et sans lunettes de soleil",
  "Photo nette et bien éclairée",
  "Photo récente",
  "Pas de filtre ni de retouche",
];

// Règles d'une photo d'identité, affichées près de l'envoi de la photo.
export function IdPhotoRules() {
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-mist px-4 py-3 text-[13px] text-slate-600">
      <p className="font-medium text-slate-700">Photo d&apos;identité</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {ID_PHOTO_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
        <li>
          Format {ID_PHOTO_REQUIREMENT.ratioLabel} (35 × 45 mm), minimum {ID_PHOTO_MIN.width} × {ID_PHOTO_MIN.height} px
        </li>
      </ul>
    </div>
  );
}
