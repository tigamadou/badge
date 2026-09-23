import type { ComponentType } from "react";
import type { VariableValues } from "./declarative/manifest-types";

export type { VariableValues };

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

// Un template rendu : meme forme quelle que soit son origine. Le moteur ne sait
// plus ce qu'est un badge — il rend un document decrit par un manifeste.
export type DocumentTemplate = {
  meta: TemplateMeta;
  Component: ComponentType<{ values: VariableValues }>;
};
