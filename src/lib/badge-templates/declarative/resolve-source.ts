import { formatFrenchDate } from "@/lib/mail-helpers";
import type { TemplateContext } from "../types";
import { SOURCES } from "./sources";

// Table explicite plutot qu'un acces dynamique par split(".") : le compilateur
// verifie chaque acces, et une source retiree du contexte devient une erreur de
// typage au lieu d'un undefined a l'execution.
const READERS: Record<string, (ctx: TemplateContext) => string | boolean> = {
  "participant.firstName": (c) => c.participant.firstName,
  "participant.lastName": (c) => c.participant.lastName,
  "participant.structure": (c) => c.participant.structure,
  "participant.photoDataUrl": (c) => c.participant.photoDataUrl,
  "category.name": (c) => c.category.name,
  "category.color": (c) => c.category.color,
  "category.neutralBadge": (c) => c.category.neutralBadge,
  "category.anonymous": (c) => c.category.anonymous,
  "event.title": (c) => c.event.title,
  // Meme formatage que les e-mails : la date d'un badge et celle d'un e-mail ne
  // doivent jamais diverger. recto-verso-v1 dupliquait cette fonction localement.
  "event.date": (c) => formatFrenchDate(c.event.date),
  "event.location": (c) => c.event.location,
  "event.logoDataUrl": (c) => c.event.logoDataUrl ?? "",
  "badge.id": (c) => c.badge.id,
  "badge.verifyUrl": (c) => c.badge.verifyUrl,
  "badge.qrCodeDataUrl": (c) => c.badge.qrCodeDataUrl,
};

export function resolveSource(ctx: TemplateContext, path: string): string | boolean {
  const reader = READERS[path];
  if (!reader || !SOURCES[path]) {
    throw new Error(`resolveSource : source inconnue "${path}"`);
  }
  return reader(ctx);
}
