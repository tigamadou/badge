import type { ComponentType } from "react";

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
  };
  badge: {
    id: string;
    verifyUrl: string;
    qrCodeDataUrl: string;
  };
};

export type BadgeTemplate = {
  meta: TemplateMeta;
  Component: ComponentType<{ ctx: TemplateContext }>;
};
