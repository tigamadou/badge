import type { AssetResolver, TemplateManifest, VariableDeclaration } from "@tigamadou/pdf-engine";
import type { Bindings } from "./bindings";

export type PageSize = {
  width: string;
  height: string;
};

export type TemplateMeta = {
  id: string;
  label: string;
  description: string;
  pages: number;
  pageSize: PageSize;
  previewSrc: string;
  version: number;
};

export type TemplateContext = {
  participant: {
    firstName: string;
    lastName: string;
    photoDataUrl: string;
    structure: string;
  };
  category: {
    name: string;
    color: string;
    neutralBadge: boolean;
    anonymous: boolean;
  };
  event: {
    title: string;
    date: Date;
    location: string;
    logoDataUrl: string | null;
    // Consignes de securite de l'evenement, deja nettoyees.
    securityInstructions: string[];
    bannerDataUrl: string | null;
    // Valeur brute de Event.templateOptions (deja ramenee a un objet).
    templateOptions: Record<string, unknown>;
    // Options image deja lues en data URL (nom -> data URL), pour garder
    // buildValues synchrone.
    templateOptionImages: Record<string, string>;
  };
  badge: {
    id: string;
    verifyUrl: string;
    qrCodeDataUrl: string;
    // All Access accorde individuellement a l'inscription (Registration.allAccessGranted).
    allAccess: boolean;
  };
};

// Le moteur ne sait plus ce qu'est un badge : il rend un document sur un
// dictionnaire de valeurs. L'application y joint ce qu'il faut pour le remplir —
// les variables declarees et la table de liaison choisie a l'installation.
export type BadgeTemplate = {
  meta: TemplateMeta;
  manifest: TemplateManifest;
  variables: VariableDeclaration[];
  bindings: Bindings;
  // Data URL des ressources prechargees (images, polices) : l'AssetResolver est synchrone.
  assets: AssetResolver;
};
