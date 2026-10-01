import type { ComponentType } from "react";
import type { VariableDeclaration, VariableValues } from "@tigamadou/pdf-engine";
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
  variables: VariableDeclaration[];
  bindings: Bindings;
  Component: ComponentType<{ values: VariableValues }>;
};
