import type { Page } from "@playwright/test";
import { uploadFile } from "@/lib/storage";
import { getDb } from "./db";

type Frame = { w: number; h: number };

// Template installe dont les blocs encadrent le logo et/ou la banniere de l'evenement.
// Le prefixe de famille `e2e-` le rend nettoyable par cleanupE2ETestData.
export async function installFramedTemplate(opts: {
  adminId: string;
  eventId: string;
  logo?: Frame;
  banner?: Frame;
}): Promise<{ id: string; cleanup(): Promise<void> }> {
  const slots = [
    { frame: opts.logo, source: "event.logoDataUrl", label: "Logo", y: 10 },
    { frame: opts.banner, source: "event.bannerDataUrl", label: "Banniere", y: 100 },
  ].filter((s): s is typeof s & { frame: Frame } => s.frame !== undefined);

  const family = `e2e-cadre-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const layout = {
    formatVersion: 3,
    family,
    label: "Cadre E2E",
    description: "",
    category: "badge",
    page: { widthPx: 320, heightPx: 460, count: 1 },
    variables: slots.map((s) => ({ name: s.source, kind: "image", label: s.label })),
    blocks: slots.map((s) => ({
      type: "rect",
      page: 1,
      name: s.label,
      x: 10,
      y: s.y,
      w: s.frame.w,
      h: s.frame.h,
      fill: "#ffffff",
      image: { source: s.source, fit: "cover" },
    })),
  };
  const row = await getDb().installedBadgeTemplate.create({
    data: {
      family,
      version: 1,
      label: "Cadre E2E",
      description: "",
      pages: 1,
      pageWidthPx: 320,
      pageHeightPx: 460,
      layout,
      bindings: Object.fromEntries(slots.map((s) => [s.source, s.source])),
      assetPrefix: `badge-templates/${family}/`,
      formatVersion: 3,
      installedById: opts.adminId,
    },
  });
  await getDb().event.update({ where: { id: opts.eventId }, data: { badgeTemplateId: row.id } });
  return {
    id: row.id,
    async cleanup() {
      await getDb().event.update({ where: { id: opts.eventId }, data: { badgeTemplateId: null } });
      await getDb().installedBadgeTemplate.delete({ where: { id: row.id } });
    },
  };
}

// Ecrit l'image dans le stockage et dans la colonne de l'evenement (dimensions memorisees).
export async function seedEventImage(
  eventId: string,
  slot: "logo" | "banner",
  buffer: Buffer,
  size: Frame,
): Promise<string> {
  const key = `e2e/${eventId}/${slot}-${Date.now()}.png`;
  await uploadFile(key, buffer, "image/png");
  await getDb().event.update({
    where: { id: eventId },
    data:
      slot === "logo"
        ? { logo: key, logoWidth: size.w, logoHeight: size.h }
        : { banner: key, bannerWidth: size.w, bannerHeight: size.h },
  });
  return key;
}

// Valide le cadrage dans la fenetre de recadrage.
export async function confirmCrop(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Valider le cadrage" }).click();
}
