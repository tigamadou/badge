import Image from "next/image";
import { Icon } from "@/components/ui/Icon";

// Trois origines d'apercu : une image, un PDF d'epreuve servi depuis le stockage
// (templates installes), ou rien du tout. Un PDF ne passe pas par next/image, d'ou
// l'aiguillage. Partage entre le selecteur, le catalogue et la page de detail.
export function TemplatePreview({ src, label }: { src: string; label: string }) {
  if (!src) {
    return (
      <span className="flex flex-col items-center gap-1 text-slate-400">
        <Icon name="id-card" size={28} />
        <span className="text-xs">Aperçu indisponible</span>
      </span>
    );
  }

  if (src.endsWith(".pdf")) {
    return (
      <object
        data={src}
        type="application/pdf"
        className="h-full w-full"
        aria-label={`Aperçu ${label}`}
      >
        <a href={src} className="text-xs text-green-700 underline">
          Ouvrir l&apos;aperçu PDF
        </a>
      </object>
    );
  }

  return (
    <Image src={src} alt={`Aperçu ${label}`} width={400} height={300} className="object-contain" />
  );
}
