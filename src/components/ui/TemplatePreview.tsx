import Image from "next/image";
import { Icon } from "@/components/ui/Icon";

// Une image (paquet ou epreuve PNG servie depuis le stockage), ou le repere « Aperçu
// indisponible » pour une source vide ou une ancienne epreuve .pdf. Partage entre le
// selecteur, le catalogue et la page de detail.
export function TemplatePreview({ src, label }: { src: string; label: string }) {
  if (!src || src.endsWith(".pdf")) {
    return (
      <span className="flex flex-col items-center gap-1 text-slate-400">
        <Icon name="id-card" size={28} />
        <span className="text-xs">Aperçu indisponible</span>
      </span>
    );
  }

  return (
    <Image src={src} alt={`Aperçu ${label}`} width={400} height={300} className="object-contain" />
  );
}
