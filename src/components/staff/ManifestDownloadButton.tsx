"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Telechargement cote client depuis le JSON deja rendu par le serveur : aucune route
// API a garder, et le layout est deja present dans la page.
export function ManifestDownloadButton({ json, filename }: { json: string; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={download} className="flex items-center gap-1.5">
      <Icon name="download" size={15} /> Télécharger le manifeste
    </Button>
  );
}
